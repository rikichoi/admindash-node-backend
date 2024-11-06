import { model, Schema } from "mongoose";

const Session = model(
    "Session",
    new Schema(
        {
            _id: {
                type: String,
                required: true
            },
            user_id: {
                type: String,
                required: true
            },
            expires_at: {
                type: Date,
                required: true
            }
        } as const,
        { timestamps: true, _id: false }
    )
);

export default Session;