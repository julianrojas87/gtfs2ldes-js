import fs from "fs/promises";
import { CronJob } from "cron";
import { processGTFS } from "../lib/GTFS.js";
import { buildIndexes, processGTFSRealtime } from "../lib/GTFSRealtime.js";

async function run() {
    // Load configuration
    const config = JSON.parse(await fs.readFile("./config.json", { encoding: "utf8" }));
    // Object to persist GTFS indexes
    let indexes = null;

    // Create cron job to process GTFS-realtime updates
    const gtfsRealtimeJob = new CronJob({
        cronTime: config["gtfs_realtime"].cron,
        onTick: async () => {
            /*if(!indexes) {
                indexes = await buildIndexes();
            }
            //processGTFSRealtime(config);*/
        }
    });

    // Create and schedule cron job to process static GTFS
    const gtfsJob = new CronJob({
        cronTime: config["gtfs"].cron,
        onTick: async () => {
            // Stop realtime process first
            if (gtfsRealtimeJob.running) {
                gtfsRealtimeJob.stop();
            }
            await processGTFS(config);
            // Refresh GTFS indexes
            indexes = null;
            // Schedule realtime job now that we processed static data
            gtfsRealtimeJob.start();
        },
        start: true
    });

    // Kick-off static data job configured for it
    if(config["general"].run_on_launch) {
        await processGTFS(config);
    }
}

run();