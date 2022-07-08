import fs from "fs/promises";
import { CronJob } from "cron";
import { Level } from "level";
import { processGTFS } from "../lib/GTFS.js";
import { buildIndexes, processGTFSRealtime } from "../lib/GTFSRealtime.js";

async function run() {
    // Load configuration
    const config = JSON.parse(await fs.readFile("./config.json", { encoding: "utf8" }));
    // Object to persist GTFS indexes
    let indexes = null;
    // Variable to avoid parallel processing of realtime updates
    let rtState = false;

    // Create cron job to process GTFS-realtime updates
    const gtfsRealtimeJob = new CronJob({
        cronTime: config["gtfs_realtime"].cron,
        start: true,
        onTick: async () => {
            if (!indexes) {
                const t0 = new Date();
                // Creating all the indexes may take some time
                // and we don't want to trigger multiple index building processes
                console.log("Building indexes for GTFS-realtime processing...");
                indexes = "building";
                indexes = await buildIndexes(config);
                if (indexes) {
                    // Retrieve reference to historic connections index
                    const historyDB = new Level(`${config["general"].data_folder}/history.db`, { valueEncoding: "json" });
                    await historyDB.open();
                    indexes.historyDB = historyDB;
                    console.log(`Indexes for GTFS-realtime processing built in ${new Date() - t0} ms`);
                    // Start processing latest realtime update
                    rtState = true;
                    await processGTFSRealtime(config, indexes);
                    rtState = false;
                } else {
                    console.warn("No GTFS sources found yet. Consider running the application with RUN_ON_LAUNCH=true to process realtime updates");
                }
            } else if (indexes !== "building" && !rtState) {
                // We have indexes and we are not processing an update already
                rtState = true;
                await processGTFSRealtime(config, indexes);
                rtState = false;
            }
        }
    });

    // Create and schedule cron job to process static GTFS
    new CronJob({
        cronTime: config["gtfs"].cron,
        start: true,
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
        }
    });

    // Trigger data jobs if configured for it
    if (config["general"].run_on_launch === "true") {
        // Temporarily stop GTFS-realtime job
        gtfsRealtimeJob.stop();
        // Process static GTFS source
        await processGTFS(config);
        // Kick-off GTFS-realtime job
        gtfsRealtimeJob.start();
    }
}

run();