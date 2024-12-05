import express from "express";
import * as DonationController from "../controllers/donationController"

const router = express.Router();

router.get("/get-stripe-donations/:prevPage&:currentPage&:lastTransactionId", DonationController.getStripeDonations);

router.get("/get-donations", DonationController.getDonations);

router.post("/create-donation/:amount&:orgId&:comment&:donorName&:itemId&:email&:phone&:payment_intent", DonationController.createDonation);

router.delete("/delete-donation/:donationId", DonationController.deleteDonation)

export default router;