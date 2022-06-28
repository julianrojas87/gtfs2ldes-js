import fs from "fs/promises";
import { CronJob } from "cron";
import { processGTFS } from "../lib/GTFS.js";

async function run() {
    // Load configuration
    const config = JSON.parse(await fs.readFile("./config.json", { encoding: "utf8" }));

    // Schedule cron job to process GTFS-realtime updates
    const gtfsRealtimeJob = new CronJob({
        cronTime: config["gtfs_realtime"].cron,
        onTick: () => {}//processGTFSRealtime(config)
    });

    // Schedule cron job to process static GTFS
    const gtfsJob = new CronJob({
        cronTime: config["gtfs"].cron,
        onTick: async () => {
            // Stop realtime process first
            if (gtfsRealtimeJob.running) {
                gtfsRealtimeJob.stop();
            }
            await processGTFS(config);
            gtfsRealtimeJob.start();
        },
        // Kick-off job
        start: true
    });

    if(config["general"].run_on_launch) {
        processGTFS(config);
    }
}

run();