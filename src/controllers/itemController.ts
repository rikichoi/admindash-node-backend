import { NextFunction, Request, Response } from "express";
import { createItemSchema, editItemSchema, itemImageSchema } from "../lib/validation";
import Item from "../models/item";
import createHttpError from "http-errors";
import { ZodError } from "zod";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { envSanitisedSchema } from '../lib/validation';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isValidObjectId } from "mongoose";
import Organisation from "../models/organisation";

const s3 = new S3Client({
    credentials: {
        accessKeyId: envSanitisedSchema.ACCESS_KEY,
        secretAccessKey: envSanitisedSchema.SECRET_ACCESS_KEY,
    },
    region: envSanitisedSchema.BUCKET_REGION
})

export const createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await createItemSchema.safeParseAsync(req.body);
        const imageData = await itemImageSchema.safeParseAsync(req.file)
        if (data.success && imageData.success) {
            const transaction = await Item.startSession();
            transaction.startTransaction();
            try {
                const itemExists = await Item.findOne({ name: data.data.name });
                if (itemExists) { res.status(400).json({ message: 'Item already exists' }) };
                try {
                    const organisation = await Organisation.findOne({ _id: data.data.orgId })
                    if (organisation) {
                        organisation.totalDonationItemsCount = organisation.totalDonationItemsCount + 1
                        const edittedOrganisation = await organisation.save()
                        const command = new PutObjectCommand({
                            Bucket: envSanitisedSchema.BUCKET_NAME,
                            Key: imageData.data.originalname,
                            Body: imageData.data.buffer,
                            ContentType: imageData.data.mimetype
                        })

                        await s3.send(command)
                        const item = await Item.create({
                            summary: data.data.summary,
                            description: data.data.description,
                            name: data.data.name,
                            donationGoalValue: data.data.donationGoalValue,
                            totalDonationValue: data.data.totalDonationValue,
                            activeStatus: data.data.activeStatus,
                            orgId: data.data.orgId,
                            itemImage: imageData.data.originalname,
                        });
                        if (item && edittedOrganisation) {
                            await transaction.commitTransaction();
                            res.status(201).json({ message: 'Item created successfully' });
                        } else {
                            await transaction.abortTransaction();
                            res.status(400).json({ message: 'Invalid item data' });
                        }
                    }
                    else {
                        await transaction.abortTransaction();
                        res.status(400).json({ message: 'Selected organisation could not be found.' });
                    }
                }
                catch (error) {
                    await transaction.abortTransaction();
                    throw createHttpError(400, `Failed to upload image. Error message: ${error}`)
                }

            } catch (error) {
                await transaction.abortTransaction();
                res.status(400).json({ message: "Unable to create item", error })
            }

        } else {
            throw createHttpError(400, `Invalid data,  ${data.error ? `Data details: ${data.error.message}` : ""}  ${imageData.error && `Image details: ${imageData.error.message}`}`);
        }

    } catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
};

export const editItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = req.params.itemId;
        if (!isValidObjectId(itemId) || !itemId) {
            throw createHttpError(400, "Invalid userId")
        }
        const data = await editItemSchema.safeParseAsync(req.body);
        const imageData = await itemImageSchema.safeParseAsync(req.file)
        if (itemId && data.success) {
            const itemExists = await Item.findOne({ _id: itemId });
            if (itemExists) {
                if (imageData.data) {
                    try {
                        const command = new PutObjectCommand({
                            Bucket: envSanitisedSchema.BUCKET_NAME,
                            Key: imageData.data.originalname,
                            Body: imageData.data.buffer,
                            ContentType: imageData.data.mimetype
                        })

                        await s3.send(command)
                    } catch (error) {
                        createHttpError(400, `Failed to upload image. ${error}`)
                    }
                }
                itemExists.summary = (data.data.summary || itemExists.summary)
                itemExists.description = (data.data.description || itemExists.description)
                itemExists.name = (data.data.name || itemExists.name)
                itemExists.activeStatus = (JSON.parse(data.data.activeStatus) || itemExists.activeStatus)
                itemExists.donationGoalValue = (data.data.donationGoalValue == "0" ? 0 : parseInt(data.data.donationGoalValue) || itemExists.donationGoalValue)
                itemExists.totalDonationValue = (data.data.totalDonationValue == "0" ? 0 : parseInt(data.data.totalDonationValue) || itemExists.totalDonationValue)
                itemExists.orgId = (data.data.orgId || itemExists.orgId)
                itemExists.itemImage = (imageData.data?.originalname || itemExists.itemImage)
                const updatedItem = await itemExists.save();
                res.status(200).json(updatedItem);
            }
            else { res.status(400).json({ message: 'Item does not exist' }) };
        }
        else {
            throw createHttpError(400, `Invalid data,  ${data.error ? `Data details: ${data.error.message}` : ""} `);
        }
    }
    // catch (error) {
    //     throw createHttpError(400, `Failed to upload image. Error message: ${error}`)
    // }
    catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
};

export const getOrgItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = req.params.orgId
        const items = await Item.find({ orgId: orgId }).exec();
        const itemsWithUrls = await Promise.all(items.map(async (e) => {
            const command = new GetObjectCommand({ Bucket: envSanitisedSchema.BUCKET_NAME, Key: e.itemImage });
            const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
            e.imageUrl = url;
            return e;
        }));
        res.status(200).json(itemsWithUrls)
    } catch (error) {
        next(error)
    }
}

export const getItems = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const items = await Item.find().exec();

        res.status(200).json(items)
    } catch (error) {
        next(error)
    }
}

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const itemId = req.params.itemId;
        if (!isValidObjectId(itemId)) {
            res.status(400).json({ message: "Invalid itemId" })
        }
        const transaction = await Item.startSession();
        transaction.startTransaction()
        try {
            const item = await Item.findOne({ _id: itemId }).exec();
            if (item) {
                const organisation = await Organisation.findOne({ _id: item.orgId }).exec();
                if (organisation) {
                    organisation.totalDonationItemsCount = organisation.totalDonationItemsCount - 1
                    organisation.save()
                    await Item.deleteOne({ _id: itemId }).exec()
                    const command = new DeleteObjectCommand({
                        Bucket: envSanitisedSchema.BUCKET_NAME,
                        Key: item.itemImage,
                    })
                    await s3.send(command)
                    transaction.commitTransaction();
                    res.status(201).json({ message: `Item: ${item} deleted successfully` });
                }
                else {
                    transaction.abortTransaction();
                    res.status(400).json({ message: "Error. Item not associated with an organisation" })
                }
            } else {
                transaction.abortTransaction();
                res.status(400).json({ message: 'Item does not exist' });

            }
        } catch (error) {
            transaction.abortTransaction();
            res.status(400).json({ message: "Error occured while trying to create item" + error })
        }
    } catch (error) {
        next(error)
    }
}

