import { NextFunction, Request, Response } from "express";
import stripe from "../lib/stripe";
import { createDonationSchema, envSanitisedSchema } from "../lib/validation";
import { ZodError } from "zod";
import createHttpError from "http-errors";
import Donation from "../models/donation";
import Item from "../models/item";
import Organisation from "../models/organisation";
import { isValidObjectId } from "mongoose";
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: "email-smtp.us-east-2.amazonaws.com",
    port: 587,
    secure: false, // upgrade later with STARTTLS
    auth: {
        user: envSanitisedSchema.AWS_SES_SMTP_USERNAME,
        pass: envSanitisedSchema.AWS_SES_PASSWORD,
    },
});



export const getStripeDonations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prevPage = req.params.prevPage
        const currentPage = req.params.currentPage
        const lastTransactionId = req.params.lastTransactionId

        if (!prevPage || !currentPage || !lastTransactionId || currentPage == "1" || prevPage == currentPage) {
            const balanceTransactions = await stripe.balanceTransactions.list({
                limit: 8,
            });
            res.status(200).json(balanceTransactions)
        }
        // ugly ass fucking code man
        if (prevPage !== "2" && currentPage !== "1" && prevPage > currentPage) {
            const balanceTransactions = await stripe.balanceTransactions.list({
                limit: 8,
                ending_before: lastTransactionId
            });
            res.status(200).json(balanceTransactions)
        }
        if (prevPage < currentPage) {
            const balanceTransactions = await stripe.balanceTransactions.list({
                limit: 8,
                starting_after: lastTransactionId
            });
            res.status(200).json(balanceTransactions)
        }
    } catch (error) {
        next(error)
    }
}

export const getDonations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const donations = await Donation.find().populate('itemId').populate('orgId')
            .exec();
        // const donationsWithItems = await Promise.all(donations.map(async (donation) => {
        //     if (donation.orgId) {
        //         const items = await Item.find({ _id: donation.itemId }).exec();
        //         const itemsWithUrls = await Promise.all(items.map(async (item) => {
        //             const command = new GetObjectCommand({ Bucket: envSanitisedSchema.BUCKET_NAME, Key: item.itemImage });
        //             const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        //             item.itemImage = url;

        //             return items;

        //         }));
        //         console.log(itemsWithUrls)
        //         return items
        //     }
        // }))
        res.status(200).json(donations)
    } catch (error) {
        next(error)
    }
}

export const createDonation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await createDonationSchema.safeParseAsync(req.params)
        if (data.success) {
            const transaction = await Donation.startSession();
            transaction.startTransaction();
            try {
                const organisation = await Organisation.findOne({ _id: data.data.orgId }).exec()
                if (organisation) {
                    organisation.totalDonationsValue = (Number(organisation.totalDonationsValue) + Number(data.data.amount))
                    organisation.totalDonationsCount = (organisation.totalDonationsCount + 1)
                    await organisation.save();
                    await Donation.create({
                        stripePaymentIntentId: data.data.payment_intent,
                        amount: parseInt(data.data?.amount),
                        orgId: data.data?.orgId,
                        comment: data.data?.comment,
                        donorName: (data.data?.donorName || ""),
                        email: data.data?.email,
                        phone: (data.data?.phone == "null" ? undefined : parseInt(data.data?.phone || "0")),
                        itemId: (data.data?.itemId
                            == "null" ? undefined : data.data?.itemId),
                    });
                    if (data.data.itemId) {
                        if (data.data.itemId !== "null") {
                            const item = await Item.findOne({ _id: data.data.itemId }).exec()

                            if (!item) {
                                await transaction.abortTransaction();
                                res.status(400).json({ message: 'Selected item could not be found' });

                            }
                            else {
                                item.totalDonationValue = (Number(item.totalDonationValue) + Number(data.data.amount))
                                await item.save();
                                await transaction.commitTransaction();
                                const organisation = await Organisation.findOne({ _id: data.data.orgId }).exec()
                                const stripeTransaction = await stripe.paymentIntents.retrieve(
                                    data.data.payment_intent
                                );

                                const latestCharge = stripeTransaction.latest_charge

                                if (latestCharge) {
                                    const stripeCharge = await stripe.charges.retrieve(latestCharge.toString())

                                    const mailOptions = {
                                        from: "suzuki.riki24@gmail.com", // sender address
                                        to: "suzuki.riki24@gmail.com", // list of receivers
                                        subject: "NexaGrid | Transaction Receipt | Thank You!", // Subject line
                                        html: `<!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @media screen and (max-width: 600px) {
                .content {
                    width: 100% !important;
                    display: block !important;
                    padding: 10px !important;
                }
    
                .header,
                .body,
                .footer {
                    padding: 20px !important;
                }
            }
        </style>
        <title>NexaGrid | Transaction Receipt</title>
    </head>
    
    <body style="font-family: 'Poppins', Arial, sans-serif">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center" style="padding: 20px;">
                    <table class="content" width="600" border="0" cellspacing="0" cellpadding="0"
                        style="border-collapse: collapse; border: 1px solid #cccccc;">
                        <tr>
                            <td class="header"
                                style="background-color: #345C72; padding: 40px; text-align: center; color: white;  font-size: 24px;">
                                <a href="https://nexagrid.vercel.app/" target="_blank"
                                    style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; width: fit-content; height: fit-content; margin: auto; display: flex; justify-content: center; justify-items: center; align-items: center; gap: 6px;">
                                    NexaGrid</a>
                            </td>
                        </tr>
    
    
                        <tr>
                            <td class="body" style="padding: 40px; text-align: left; font-size: 18px; line-height: 1.6;">
                                <p style="font-size: 24px">Payment Confirmation</p> <br>
                                Hi ${data.data.donorName || undefined},
                                <br><br>
                                Thanks, we've received your payment. It may take up to 48 hours for these changes to be
                                applied to your online account.
    
                                <br><br>
                                <b>Your donation details:</b>
    
                                <br><br>
                                Donation type
                                <br>
                                ${data.data.itemId && data.data.itemId !== "null" ? "Item Donation" : "General Donation"}
    
                                <br><br>
                                Organisation
                                <br>
                                ${organisation && organisation.name}
    
    
                                ${item && `<br><br>
                                Item
                                <br>
                                ${item.name}`}
    
                                <br><br>
    
                                <hr>
                                <br>
                                <b>Your payment details:</b>
                                <br><br>
                                Payment type
                                <br>
                                ${stripeCharge.payment_method_details?.type}
    
                                <br><br>
                                Amount Paid
                                <br>
                                ${data.data.amount}
    
                                <br><br>
                                Date paid
                                <br>
                                ${new Date().toLocaleDateString()}
    
                                <br><br>
                                Receipt number
                                <br>
                                ${data.data.payment_intent}
    
                                <br><br>
                                Billed to
                                <br>
                                ${data.data.donorName}
                                <br>
                                ${stripeCharge.payment_method_details?.card?.brand} ...${stripeCharge.payment_method_details?.card?.last4}
                                <br>
                                Exp ${stripeCharge.payment_method_details?.card?.exp_month}/${stripeCharge.payment_method_details?.card?.exp_year}
    
                            </td>
                        </tr>
    
                        <tr>
                            <td style="padding: 40px 40px 40px 40px; text-align: center; font-size: 18px;">
                                Need help?
                                <table cellspacing="50" cellpadding="0" style="margin: auto;">
                                    <tr>
                                        <td>
                                            <a href="https://nexagrid.vercel.app/" target="_blank"
                                                style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; padding: 20px 30px; border-radius: 5px;">
                                                Visit our Contact page</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
    
                        <tr>
                            <td class="footer"
                                style="background-color: #333333; padding: 40px; text-align: center; color: white; font-size: 14px;">
                                Copyright &copy; ${new Date().getFullYear()} | NexaGrid
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    
    </html>`,
                                        amp: `<!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @media screen and (max-width: 600px) {
                .content {
                    width: 100% !important;
                    display: block !important;
                    padding: 10px !important;
                }
    
                .header,
                .body,
                .footer {
                    padding: 20px !important;
                }
            }
        </style>
        <title>NexaGrid | Transaction Receipt</title>
    </head>
    
    <body style="font-family: 'Poppins', Arial, sans-serif">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center" style="padding: 20px;">
                    <table class="content" width="600" border="0" cellspacing="0" cellpadding="0"
                        style="border-collapse: collapse; border: 1px solid #cccccc;">
                        <tr>
                            <td class="header"
                                style="background-color: #345C72; padding: 40px; text-align: center; color: white;  font-size: 24px;">
                                <a href="https://nexagrid.vercel.app/" target="_blank"
                                    style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; width: fit-content; height: fit-content; margin: auto; display: flex; justify-content: center; justify-items: center; align-items: center; gap: 6px;">
                                    NexaGrid</a>
                            </td>
                        </tr>
    
    
                        <tr>
                            <td class="body" style="padding: 40px; text-align: left; font-size: 18px; line-height: 1.6;">
                                <p style="font-size: 24px">Payment Confirmation</p> <br>
                                Hi ${data.data.donorName || undefined},
                                <br><br>
                                Thanks, we've received your payment. It may take up to 48 hours for these changes to be
                                applied to your online account.
    
                                <br><br>
                                <b>Your donation details:</b>
    
                                <br><br>
                                Donation type
                                <br>
                                ${data.data.itemId && data.data.itemId !== "null" ? "Item Donation" : "General Donation"}
    
                                <br><br>
                                Organisation
                                <br>
                                ${organisation && organisation.name}
    
    
                                ${item && `<br><br>
                                Item
                                <br>
                                ${item.name}`}
    
                                <br><br>
    
                                <hr>
                                <br>
                                <b>Your payment details:</b>
                                <br><br>
                                Payment type
                                <br>
                                ${stripeCharge.payment_method_details?.type}
    
                                <br><br>
                                Amount Paid
                                <br>
                                ${data.data.amount}
    
                                <br><br>
                                Date paid
                                <br>
                                ${new Date().toLocaleDateString()}
    
                                <br><br>
                                Receipt number
                                <br>
                                ${data.data.payment_intent}
    
                                <br><br>
                                Billed to
                           <br>
                                ${data.data.donorName}
                                <br>
                                ${stripeCharge.payment_method_details?.card?.brand} ...${stripeCharge.payment_method_details?.card?.last4}
                                <br>
                                Exp ${stripeCharge.payment_method_details?.card?.exp_month}/${stripeCharge.payment_method_details?.card?.exp_year}
    
                            </td>
                        </tr>
    
                        <tr>
                            <td style="padding: 40px 40px 40px 40px; text-align: center; font-size: 18px;">
                                Need help?
                                <table cellspacing="50" cellpadding="0" style="margin: auto;">
                                    <tr>
                                        <td>
                                            <a href="https://nexagrid.vercel.app/" target="_blank"
                                                style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; padding: 20px 30px; border-radius: 5px;">
                                                Visit our Contact page</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
    
                        <tr>
                            <td class="footer"
                                style="background-color: #333333; padding: 40px; text-align: center; color: white; font-size: 14px;">
                                Copyright &copy; ${new Date().getFullYear()} | NexaGrid
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    
    </html>`,
                                    }

                                    transporter.sendMail(mailOptions, (error, info) => {
                                        if (error) {
                                            console.log("Error:", error);
                                        } else {
                                            console.log("Email sent:", info.response)
                                        }
                                    })
                                    res.status(201).json({ message: "Donation created successfully" })
                                }

                            }
                        }
                        else {
                            await transaction.commitTransaction();
                            const organisation = await Organisation.findOne({ _id: data.data.orgId }).exec()
                            const stripeDonation = await stripe.paymentIntents.retrieve(
                                data.data.payment_intent
                            );
                            const mailOptions = {
                                from: "suzuki.riki24@gmail.com", // sender address
                                to: "suzuki.riki24@gmail.com", // list of receivers
                                subject: "NexaGrid | Transaction Receipt | Thank You!", // Subject line
                                html: `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @media screen and (max-width: 600px) {
            .content {
                width: 100% !important;
                display: block !important;
                padding: 10px !important;
            }

            .header,
            .body,
            .footer {
                padding: 20px !important;
            }
        }
    </style>
    <title>NexaGrid | Transaction Receipt</title>
</head>

<body style="font-family: 'Poppins', Arial, sans-serif">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center" style="padding: 20px;">
                <table class="content" width="600" border="0" cellspacing="0" cellpadding="0"
                    style="border-collapse: collapse; border: 1px solid #cccccc;">
                    <tr>
                        <td class="header"
                            style="background-color: #345C72; padding: 40px; text-align: center; color: white;  font-size: 24px;">
                            <a href="https://nexagrid.vercel.app/" target="_blank"
                                style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; width: fit-content; height: fit-content; margin: auto; display: flex; justify-content: center; justify-items: center; align-items: center; gap: 6px;">
                                NexaGrid</a>
                        </td>
                    </tr>


                    <tr>
                        <td class="body" style="padding: 40px; text-align: left; font-size: 18px; line-height: 1.6;">
                            <p style="font-size: 24px">Payment Confirmation</p> <br>
                            Hi ${data.data.donorName || undefined},
                            <br><br>
                            Thanks, we've received your payment. It may take up to 48 hours for these changes to be
                            applied to your online account.

                            <br><br>
                            <b>Your donation details:</b>

                            <br><br>
                            Donation type
                            <br>
                            ${data.data.itemId && data.data.itemId !== "null" ? "Item Donation" : "General Donation"}

                            <br><br>
                            Organisation
                            <br>
                            ${organisation && organisation.name}

                            <br><br>

                            <hr>
                            <br>
                            <b>Your payment details:</b>
                            <br><br>
                            Payment type
                            <br>
                            ${stripeDonation.payment_method}
                            ${stripeDonation.payment_method_configuration_details}
                            ${stripeDonation.payment_method_options}

                            <br><br>
                            Amount Paid
                            <br>
                            ${data.data.amount}

                            <br><br>
                            Date paid
                            <br>
                            ${new Date().toLocaleDateString()}

                            <br><br>
                            Receipt number
                            <br>
                            ${data.data.payment_intent}

                            <br><br>
                            Billed to
                            <br>
                            ${data.data.donorName}
                            ${stripeDonation}

                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px 40px 40px 40px; text-align: center; font-size: 18px;">
                            Need help?
                            <table cellspacing="50" cellpadding="0" style="margin: auto;">
                                <tr>
                                    <td>
                                        <a href="https://nexagrid.vercel.app/" target="_blank"
                                            style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; padding: 20px 30px; border-radius: 5px;">
                                            Visit our Contact page</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td class="footer"
                            style="background-color: #333333; padding: 40px; text-align: center; color: white; font-size: 14px;">
                            Copyright &copy; ${new Date().getFullYear()} | NexaGrid
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>`,
                                amp: `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @media screen and (max-width: 600px) {
            .content {
                width: 100% !important;
                display: block !important;
                padding: 10px !important;
            }

            .header,
            .body,
            .footer {
                padding: 20px !important;
            }
        }
    </style>
    <title>NexaGrid | Transaction Receipt</title>
</head>

<body style="font-family: 'Poppins', Arial, sans-serif">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center" style="padding: 20px;">
                <table class="content" width="600" border="0" cellspacing="0" cellpadding="0"
                    style="border-collapse: collapse; border: 1px solid #cccccc;">
                    <tr>
                        <td class="header"
                            style="background-color: #345C72; padding: 40px; text-align: center; color: white;  font-size: 24px;">
                            <a href="https://nexagrid.vercel.app/" target="_blank"
                                style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; width: fit-content; height: fit-content; margin: auto; display: flex; justify-content: center; justify-items: center; align-items: center; gap: 6px;">
                                NexaGrid</a>
                        </td>
                    </tr>


                    <tr>
                        <td class="body" style="padding: 40px; text-align: left; font-size: 18px; line-height: 1.6;">
                            <p style="font-size: 24px">Payment Confirmation</p> <br>
                            Hi ${data.data.donorName || undefined},
                            <br><br>
                            Thanks, we've received your payment. It may take up to 48 hours for these changes to be
                            applied to your online account.

                            <br><br>
                            <b>Your donation details:</b>

                            <br><br>
                            Donation type
                            <br>
                            ${data.data.itemId && data.data.itemId !== "null" ? "Item Donation" : "General Donation"}

                            <br><br>
                            Organisation
                            <br>
                            ${organisation && organisation.name}

                            <br><br>

                            <hr>
                            <br>
                            <b>Your payment details:</b>
                            <br><br>
                            Payment type
                            <br>
                            ${stripeDonation.payment_method}
                            ${stripeDonation.payment_method_configuration_details}
                            ${stripeDonation.payment_method_options}

                            <br><br>
                            Amount Paid
                            <br>
                            ${data.data.amount}

                            <br><br>
                            Date paid
                            <br>
                            ${new Date().toLocaleDateString()}

                            <br><br>
                            Receipt number
                            <br>
                            ${data.data.payment_intent}

                            <br><br>
                            Billed to
                            <br>
                            ${data.data.donorName}
                            ${stripeDonation}

                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px 40px 40px 40px; text-align: center; font-size: 18px;">
                            Need help?
                            <table cellspacing="50" cellpadding="0" style="margin: auto;">
                                <tr>
                                    <td>
                                        <a href="https://nexagrid.vercel.app/" target="_blank"
                                            style="color: #ffffff; text-decoration: none; font-weight: bold; background-color: #345C72; padding: 20px 30px; border-radius: 5px;">
                                            Visit our Contact page</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td class="footer"
                            style="background-color: #333333; padding: 40px; text-align: center; color: white; font-size: 14px;">
                            Copyright &copy; ${new Date().getFullYear()} | NexaGrid
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>`,
                            }

                            transporter.sendMail(mailOptions, (error, info) => {
                                if (error) {
                                    console.log("Error:", error);
                                } else {
                                    console.log("Email sent:", info.response)

                                }
                            })
                            res.status(201).json({ message: "Donation created successfully  with item" })
                        }
                    }
                    else {
                        await transaction.abortTransaction();
                        res.status(400).json({ message: "Unable to create donation due to no relevant stripe transaction data" })

                    }
                }
            }
            catch (error) {
                await transaction.abortTransaction();
                res.status(400).json({ message: "Unable to create donation", error })
            }
        }
    }
    catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
}

export const deleteDonation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const donationId = req.params.donationId
        if (!isValidObjectId(donationId)) {
            res.status(400).json({ message: `Donation with ID: ${donationId} does not exist` })
        }
        const transaction = await Donation.startSession();
        transaction.startTransaction();
        try {
            const donation = await Donation.findOne({ _id: donationId }).exec();
            if (donation) {
                const organisation = await Organisation.findOne({ _id: donation.orgId }).exec();
                if (organisation) {
                    organisation.totalDonationsCount = organisation.totalDonationsCount - 1
                    organisation.totalDonationsValue = organisation.totalDonationsValue - donation.amount
                    await organisation.save();
                    if (donation.itemId) {
                        const item = await Item.findOne({ _id: donation.itemId }).exec();
                        if (item) {
                            item.totalDonationValue = item.totalDonationValue - donation.amount
                            await item.save()
                        }
                        else {
                            await transaction.abortTransaction();
                            res.status(400).json({ message: "Invalid itemId associated with donation" })
                        }
                    }

                    await Donation.deleteOne({ _id: donationId })
                    await transaction.commitTransaction();
                    res.status(200).json({ message: "Donation deleted successfully" })
                }
                else {
                    await transaction.abortTransaction();
                    res.status(400).json({ message: "Organisation not found" })
                }
            }
            else {
                await transaction.abortTransaction();
                res.status(400).json({ message: `Donation with ID: ${donationId} does not exist` })
            }
        }
        catch (error) {
            await transaction.abortTransaction();
            res.status(400).json({ message: "Unable to create donation", error })
        }
    }
    catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
}