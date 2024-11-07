import express from "express";
import * as DonationController from "../controllers/donationController"

const router = express.Router();

router.get("/get-stripe-donations", DonationController.getStripeDonations);

router.get("/get-donations", DonationController.getDonations);

router.post("/create-donation/:amount&:orgId&:comment&:donorName&:itemId&:email&:phone", DonationController.createDonation);

export default router;