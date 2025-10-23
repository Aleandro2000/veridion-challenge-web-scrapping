import { FastifyReply, FastifyRequest } from "fastify";
import Fuse from "fuse.js";
import { logger } from "../utils/utils";
import { contactDataModel } from "../models/contact.model";
import { Types } from "mongoose";

export default {
    search: async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            const {
                q = "",
                limit = 20,
                page = 1,
                sort_by = "score",
                order = "desc",
                near,
            } = request.query as {
                q?: string;
                limit?: number;
                page?: number;
                sort_by?: string;
                order?: "asc" | "desc";
                near?: { lat: number; lng: number; maxDistance?: number };
            };

            if (!q.trim()) {
                return reply.status(400).send({
                    status: 400,
                    message: "Query parameter 'q' is required",
                });
            }

            let candidates = [];
            try {
                candidates = await contactDataModel
                    .find({ $text: { $search: q } })
                    .limit(200)
                    .lean();
            } catch (error) {
                logger(error, true);
            }

            if (!candidates.length) {
                if (Types.ObjectId.isValid(q)) {
                    return reply.status(200).send({
                        status: 200,
                        total: 1,
                        page,
                        pages: 1,
                        results: [{
                            ...(await contactDataModel.findById(q)).toObject(),
                            _score: 1,
                        }],
                    });
                }

                const regexFilter = {
                    $or: [
                        { company_commercial_name: { $regex: q, $options: "i" } },
                        { company_legal_name: { $regex: q, $options: "i" } },
                        { url: { $regex: q, $options: "i" } },
                        { address: { $regex: q, $options: "i" } },
                        { "socials.facebook": { $regex: q, $options: "i" } },
                        { "socials.instagram": { $regex: q, $options: "i" } },
                        { "socials.linkedin": { $regex: q, $options: "i" } },
                        { "socials.twitter": { $regex: q, $options: "i" } },
                        { "socials.tiktok": { $regex: q, $options: "i" } },
                        { phones: { $elemMatch: { $regex: q, $options: "i" } } },
                    ],
                };

                candidates = await contactDataModel.find(regexFilter).limit(200).lean();
            }

            if (near && near.lat && near.lng) {
                candidates = candidates.filter((doc) => {
                    const coords = doc.coords || {};
                    if (!coords.lng || !coords.lat) {
                        return false;
                    }
                    const R = 6371;
                    const dLat = ((near.lat - coords.lat) * Math.PI) / 180;
                    const dLon = ((near.lng - coords.lng) * Math.PI) / 180;
                    const a =
                        Math.sin(dLat / 2) ** 2 +
                        Math.cos((near.lat * Math.PI) / 180) *
                        Math.cos((coords.lat * Math.PI) / 180) *
                        Math.sin(dLon / 2) ** 2;
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distance = R * c * 1000;
                    return distance <= (near.maxDistance || 10000);
                });
            }

            if (!candidates.length) {
                return reply.status(200).send({
                    status: 200,
                    total: 0,
                    results: [],
                });
            }

            const fuse = new Fuse(candidates, {
                includeScore: true,
                threshold: 0.4,
                keys: [
                    "company_commercial_name",
                    "company_legal_name",
                    "url",
                    "address",
                    "phones",
                    "socials.facebook",
                    "socials.instagram",
                    "socials.linkedin",
                    "socials.twitter",
                    "socials.tiktok",
                ],
            });

            const fuzzyResults = fuse.search(q);

            let sorted = fuzzyResults;

            if (sort_by === "score") {
                sorted = fuzzyResults.sort((a, b) =>
                    order === "asc" ? a.score - b.score : b.score - a.score
                );
            } else {
                sorted = fuzzyResults.sort((a, b) => {
                    const aVal = a.item[sort_by];
                    const bVal = b.item[sort_by];
                    if (aVal === bVal) return 0;
                    if (order === "asc") return aVal > bVal ? 1 : -1;
                    return aVal < bVal ? 1 : -1;
                });
            }

            const skip = (page - 1) * limit;
            const paginated = sorted.slice(skip, skip + limit);

            return reply.status(200).send({
                status: 200,
                total: fuzzyResults.length,
                page,
                pages: Math.ceil(fuzzyResults.length / limit),
                results: paginated.map((r) => ({
                    ...r.item,
                    _score: (1 - r.score).toFixed(3),
                })),
            });
        } catch (error) {
            logger(error, true);
            return reply.status(500).send({
                status: 500,
                message: error.message || "Fuzzy search failed",
            });
        }
    },
    getById: async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.query as { id: number };
            const contactData = await contactDataModel.findOne({ id });
            return reply.status(200).send({
                status: 200,
                message: "Contact found!",
                result: contactData,
            });
        } catch (error) {
            logger(error, true);
            return reply.status(500).send({
                status: 500,
                message: error.message || "Contact not found!",
            });
        }
    }
};
