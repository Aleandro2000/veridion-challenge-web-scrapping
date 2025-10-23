import { SocialLinks } from "./social-links.type";

export type ContactData = {
    company_commercial_name?: string;
    company_legal_name?: string;
    company_all_available_names?: string[];
    url: string;
    phones: string[];
    socials: SocialLinks;
    address?: string | null;
    success: boolean;
    error?: string;
    coords?: JSON,
}