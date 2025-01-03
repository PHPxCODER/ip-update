import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5555;

const dnsRecords: string[] = process.env.CF_DNS?.split(",") || [];

// Middleware to check the API key
app.use((req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.header("rdp-key") || req.query.api_key;

    if (!apiKey) {
        // No API key provided
        res.status(400).json({ status: "failed", message: "Missing api_key or rdp-key Header" });
    } else if (apiKey !== process.env.RDP_API_KEY) {
        // API key is provided but is incorrect
        res.status(401).json({ status: "failed", message: "Invalid API Key" });
    } else {
        // API key is correct, proceed to the route
        next();
    }
});

app.get("/", async (req: Request, res: Response) => {
    try {
        const response = await axios.get<{ ip: string }>("https://api.ipify.org?format=json");
        const ip = response.data.ip;

        const updateResults = await Promise.all(
            dnsRecords.map(async (dnsRecord) => {
                const currentRecord = await axios.get(
                    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE}/dns_records/${dnsRecord}`,
                    {
                        headers: {
                            "X-Auth-Email": process.env.CF_MAIL as string,
                            Authorization: `Bearer ${process.env.CF_AUTH}`,
                        },
                    }
                );

                const recordData = currentRecord.data.result;

                const update = await axios.put(
                    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE}/dns_records/${dnsRecord}`,
                    {
                        type: recordData.type, // Keep the same record type (e.g., "A" record)
                        name: recordData.name, // Keep the same name
                        content: ip,          // Update only the IP address
                        ttl: recordData.ttl,  // Keep the same TTL
                        proxied: recordData.proxied, // Keep the proxy setting
                    },
                    {
                        headers: {
                            "X-Auth-Email": process.env.CF_MAIL as string,
                            Authorization: `Bearer ${process.env.CF_AUTH}`,
                        },
                    }
                );
                return update;
            })
        );

        const success = updateResults.every((update) => update.status === 200);
        res.json({ status: success ? "success" : "failed" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "fail", error: "An error occurred, Check Logs" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
