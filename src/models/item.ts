import { model, Schema } from "mongoose";

type Item = {
    summary: string;
    description: string;
    name: string;
    donationGoalValue: number;
    totalDonationValue: number;
    activeStatus: boolean;
    itemImage: string;
    imageUrl: string;
    orgId: string;
    createdAt: Date;
    updatedAt: Date;
}

const ItemSchema = new Schema({
    summary: { type: String, required: true },
    description: { type: String, required: true },
    name: { type: String, required: true },
    donationGoalValue: { type: Number, required: true },
    totalDonationValue: { type: Number, required: true },
    activeStatus: { type: Boolean, required: true },
    itemImage: { type: String, required: true },
    imageUrl: { type: String, required: false },
    orgId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true }
}, { timestamps: true });

export default model<Item>("Item", ItemSchema);