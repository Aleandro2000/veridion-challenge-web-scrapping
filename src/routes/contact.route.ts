import { type FastifyInstance } from "fastify";
import contactService from "../services/contact.service";

export default function (fastify: FastifyInstance, _opts: unknown, done: () => void) {
    fastify.get("/search", {
        schema: {
            summary: "Smart search for contact data",
            tags: ["Contacts"],
            querystring: {
                type: "object",
                properties: {
                    q: { type: "string", description: "Search query" },
                    limit: { type: "number", default: 20 },
                    page: { type: "number", default: 1 },
                    sort_by: { type: "string", default: "score" },
                    order: { type: "string", enum: ["asc", "desc"], default: "desc" },
                    near: {
                        type: "object",
                        properties: {
                            lat: { type: "number" },
                            lng: { type: "number" },
                            maxDistance: { type: "number" },
                        },
                    },
                },
            },
        },
        handler: contactService.search,
    });

    fastify.get("/get_by_id", {
        schema: {
            summary: "Get contact data by ID",
            tags: ["Contacts"],
            querystring: {
                type: "object",
                properties: {
                    id: { type: "number", description: "MongoDB _id or numeric id" },
                },
                required: ["id"],
            },
        },
        handler: contactService.getById,
    });

    done();
}