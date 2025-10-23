import Fastify from "fastify";
import process from "process";
import { config } from "dotenv";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimitPlugin from "./src/plugins/rate-limit.plugin";
import { constants } from "zlib";
import cron from "node-cron";
import mongooseConnection from "./src/connections/mongoose.connection";
import { contactSchedule } from "./src/schedules/contact.schedule";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifySwagger from "@fastify/swagger";
import contactRoute from "./src/routes/contact.route";

config();

mongooseConnection();

const fastify = Fastify({
    logger: process.env.APP_MODE !== "production",
    ajv: {
        customOptions: {
            strict: false,
            keywords: ["api"],
        },
    },
    bodyLimit: 5 * 1024 * 1024,
});

fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET"],
});
fastify.register(helmet);
fastify.register(compress, {
    global: true,
    threshold: 1024 * 1024 * 100,
    inflateIfDeflated: true,
    brotliOptions: {
        [constants.BROTLI_PARAM_QUALITY]: 6,
    },
});
fastify.register(rateLimitPlugin);

if (process.env.APP_MODE !== "production") {
    fastify.register(fastifySwagger, {
        openapi: {
            openapi: "3.1.0",
            info: {
                title: "Veridion Challenge",
                description: "Veridion Challenge documentation with Swagger",
                version: "1.0.0",
            },
            servers: [
                {
                    url: `http://${process.env.APP_IP || "localhost"}:${process.env.APP_PORT || "8081"}`,
                },
            ],
            tags: [
                { name: "Contacts", description: "Smart search for contact data" },
            ],
        },
    });
    fastify.register(fastifySwaggerUi, {
        routePrefix: "/api",
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
    });
}

fastify.register(contactRoute, {
    prefix: "/api/v1",
});

fastify.listen(
    {
        host: "0.0.0.0",
        port: parseInt(process.env.APP_PORT) || 8081,
    },
    (err: Error) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    }
);

contactSchedule();

cron.schedule("0 0 1 * *", contactSchedule);