import { NextFunction, Request, Response } from "express";
import { createOrganisationSchema, editOrganisationSchema, envSanitisedSchema } from "../lib/validation";
import { ZodError } from "zod";
import createHttpError from "http-errors";
import Organisation from "../models/organisation";
import { isValidObjectId } from "mongoose";
import Item from "../models/item";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "crypto"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// TODO: look into image resizing and optimisation later
// import sharp from "sharp";

const s3 = new S3Client({
    credentials: {
        accessKeyId: envSanitisedSchema.ACCESS_KEY,
        secretAccessKey: envSanitisedSchema.SECRET_ACCESS_KEY,
    },
    region: envSanitisedSchema.BUCKET_REGION
})

function generateUniqueImageName(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
}

export const createOrganisation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await createOrganisationSchema.safeParseAsync(req.body)
        const imageData = req.files
        if (data.success && Array.isArray(imageData)) {
            const imageNameArray: string[] = [];
            await Promise.all(imageData.map(async (image) => {
                const imageName = generateUniqueImageName();
                const command = new PutObjectCommand({
                    Bucket: envSanitisedSchema.BUCKET_NAME,
                    Key: imageName,
                    Body: image.buffer,
                    ContentType: image.mimetype
                });

                await s3.send(command);
                imageNameArray.push(imageName)
            }));
            const organisation = await Organisation.create({
                ABN: data.data?.ABN,
                activeStatus: data.data?.activeStatus,
                description: data.data?.description,
                image: imageNameArray,
                name: data.data?.name,
                phone: data.data?.phone,
                summary: data.data?.summary,
                totalDonationItemsCount: data.data?.totalDonationItemsCount,
                totalDonationsCount: data.data?.totalDonationsCount,
                totalDonationsValue: data.data?.totalDonationsValue,
                website: data.data?.website,
            });
            if (organisation) {
                res.status(201).json({ message: 'Organisation created successfully ' });
            } else {
                res.status(400).json({ message: 'Failed to create Organisation' });
            }
        } else {
            throw createHttpError(400, `'Invalid data', details: ${data.error && data.error.message}`);
        }
    } catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)

        }
    }
}

export const getOrganisations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const organisations = await Organisation.find().exec();
        const organisationsWithUrls = await Promise.all(organisations.map(async (organisation) => {
            await Promise.all(organisation.image.map(async (img) => {
                const imageUrlsArray: string[] = []
                const command = new GetObjectCommand({ Bucket: envSanitisedSchema.BUCKET_NAME, Key: img });
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
                imageUrlsArray.push(url)
                organisation.imageUrls = imageUrlsArray;
            }));
            return organisation;
        }));
        res.status(200).json(organisationsWithUrls)
    } catch (error) {
        next(error)
    }
}

export const getPaginatedOrganisations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentPage = req.params.currentPage
        const skip = (currentPage == "1" || !currentPage ? 0 : (parseInt(currentPage) - 1) * 5)
        const limit = 5
        const organisations = await Organisation.find().skip(skip).limit(limit).exec();
        const organisationsWithUrls = await Promise.all(organisations.map(async (organisation) => {
            await Promise.all(organisation.image.map(async (img) => {
                const imageUrlsArray: string[] = []
                const command = new GetObjectCommand({ Bucket: envSanitisedSchema.BUCKET_NAME, Key: img });
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
                imageUrlsArray.push(url)
                organisation.imageUrls = imageUrlsArray;
            }));
            return organisation;
        }));
        res.status(200).json(organisationsWithUrls)
    } catch (error) {
        next(error)
    }
}

export const getOrganisationsCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const count = await Organisation.countDocuments().exec()
        res.status(200).json(count)
    } catch (error) {
        next(error)
    }
}

export const editOrganisation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = req.params.orgId
        const data = await editOrganisationSchema.safeParseAsync(req.body)
        const newImageData = req.files
        if (!isValidObjectId(orgId)) {
            throw createHttpError(400, "Invalid orgId")
        }
        if (data.success) {
            const organisation = await Organisation.findOne({ _id: orgId }).exec();
            if (!organisation) { throw createHttpError(404, "Organisation does not exist") }
            else {
                const imageNameArray: string[] = [];
                if (newImageData && Array.isArray(newImageData)) {
                    await Promise.all(newImageData.map(async (image) => {
                        const imageName = generateUniqueImageName();
                        const command = new PutObjectCommand({
                            Bucket: envSanitisedSchema.BUCKET_NAME,
                            Key: imageName,
                            Body: image.buffer,
                            ContentType: image.mimetype
                        });

                        await s3.send(command);
                        imageNameArray.push(imageName)
                    }));
                }
                //TODO: implement delete function for any removed previousimage items from s3 bucket
                data.data.previousImages.map(item => {
                    if (item) {
                        imageNameArray.push(item);
                    }
                });

                organisation.ABN = (parseInt(data.data.ABN) || organisation.ABN)
                organisation.activeStatus = (JSON.parse(data.data.activeStatus) || organisation.activeStatus)
                organisation.description = (data.data.description || organisation.description)
                organisation.image = (imageNameArray || organisation.image)
                organisation.name = (data.data.name || organisation.name)
                organisation.phone = (parseInt(data.data.phone) || organisation.phone)
                organisation.summary = (data.data.summary || organisation.summary)
                organisation.website = (data.data.website || organisation.website)
                organisation.totalDonationsCount = (data.data.totalDonationsCount == "0" ? 0 : parseInt(data.data.totalDonationsCount) || organisation.totalDonationsCount)
                organisation.totalDonationItemsCount = (data.data.totalDonationItemsCount == "0" ? 0 : parseInt(data.data.totalDonationItemsCount) || organisation.totalDonationItemsCount)
                organisation.totalDonationsValue = (data.data.totalDonationsValue == "0" ? 0 : parseInt(data.data.totalDonationsValue) || organisation.totalDonationItemsCount)
                const edittedOrganisation = await organisation.save();
                res.status(200).json(edittedOrganisation)
            }
        } else {
            throw createHttpError(400, `'Invalid data', details: ${data.error.message}`);
        }
    } catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)

        }
    }
}

export const deleteOrganisation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orgId = req.params.orgId;
        console.log(req.params.orgId, orgId)
        if (!isValidObjectId(orgId)) {
            throw createHttpError(400, "Invalid orgId")
        }
        const organisation = Organisation.find({ _id: orgId }).exec();
        if (!organisation) {
            res.status(400).json({ message: 'Organisation does not exist' });
        } else {
            const transaction = await Organisation.startSession()
            transaction.startTransaction();
            try {
                await Item.deleteMany({ orgId: orgId }).exec()
                await Organisation.deleteOne({ _id: orgId }).exec()
                await transaction.commitTransaction();
                res.status(201).json({ message: 'Organisation and associated items deleted successfully' });
            } catch (error) {
                await transaction.abortTransaction()
                res.status(400).json({ message: `Error occured in transaction. Aborting... ${error}` });
            }
        }
    }
    catch (error) {
        next(error)
    }
}