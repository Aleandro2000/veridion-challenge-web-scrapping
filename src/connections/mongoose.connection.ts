import mongoose from "mongoose";
import { config } from "dotenv";
import { logger } from "../utils/utils";

config();

export default function mongooseConnection(shouldReconnect = true) {
    mongoose.set("strictQuery", false);
    mongoose
        .connect(process.env.DB_URL, {
            autoIndex: true,
            retryReads: true,
            retryWrites: true,
        })
        .then(async () => {
            logger(`Connected to MongoDB: %s \n ${process.env.DB_URL}`);
        })
        .catch((err: Error) => {
            logger(`MongoDB connection error: %s \n ${err}`);
            if (shouldReconnect) {
                setTimeout(() => mongooseConnection(), 5000);
            }
        });
}