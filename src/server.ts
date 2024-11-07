import 'dotenv/config'
import mongoose from 'mongoose';
import { envSanitisedSchema } from './lib/validation';
import app from './app';


mongoose.connect(envSanitisedSchema.MONGO_DB_CONNECTION_STRING)
    .then(() => {
        console.log("Connected to MongoDB Successfully!")
        app.listen(envSanitisedSchema.PORT, () => {
            console.log(`Server successfully started on PORT:${envSanitisedSchema.PORT}/`);
        })
    }
    )

