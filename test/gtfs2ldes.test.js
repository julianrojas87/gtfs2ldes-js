import { jest, test, beforeAll, afterAll, expect } from "@jest/globals";
import fastify from "fastify";
import { Level } from "level";
import { deleteAsync } from "del";
import { processGTFS } from "../lib/GTFS.js";
import { buildIndexes, processGTFSRealtime } from "../lib/GTFSRealtime.js";

// Mock config
const config = {
    "general": {
        "data_folder": "./test/data",
        "target_url": "http://0.0.0.0:3001/test",
        "throttle_rate": 5
    },
    "gtfs": {},
    "gtfs_realtime": {},
    "@context": {
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "dct": "http://purl.org/dc/terms/",
        "prov": "http://www.w3.org/ns/prov#",
        "lc": "http://semweb.mmlab.be/ns/linkedconnections#",
        "gtfs": "http://vocab.gtfs.org/terms#",
        "wgs": "http://www.w3.org/2003/01/geo/wgs84_pos#",
        "gsp": "http://www.opengis.net/ont/geosparql#",
        "gtfs:trip": { "@type": "@id" },
        "gtfs:route": { "@type": "@id" },
        "gtfs:pickupType": { "@type": "@id" },
        "gtfs:dropOffType": { "@type": "@id" },
        "wgs:lat": { "@type": "xsd:double" },
        "wgs:long": { "@type": "xsd:double" },
        "gsp:asWKT": { "@type": "gsp:wktLiteral" },
        "Stop": { "@id": "gtfs:Stop", "@type": "@id" },
        "Connection": { "@id": "lc:Connection", "@type": "@id" },
        "CancelledConnection": { "@id": "lc:CancelledConnection", "@type": "@id" },
        "departureTime": { "@id": "lc:departureTime", "@type": "xsd:dateTime" },
        "arrivalTime": { "@id": "lc:arrivalTime", "@type": "xsd:dateTime" },
        "departureStop": { "@id": "lc:departureStop", "@type": "@id" },
        "arrivalStop": { "@id": "lc:arrivalStop", "@type": "@id" },
        "isVersionOf": { "@id": "dct:isVersionOf", "@type": "@id" },
        "generatedAtTime": { "@id": "prov:generatedAtTime", "@type": "xsd:dateTime" }
    },
    "uri_templates": {
        "stop": "https://data.delijn.be/stops/{stops.stop_code}",
        "connection": "https://data.delijn.be/connections/{routeName}/{direction}/{tripStartTime}/{depStop}/{depTime}/{arrStop}/",
        "trip": "https://data.delijn.be/trips/{routeName}/{direction}/{tripStartTime}",
        "route": "https://data.delijn.be/routes/{routeName}",
        "resolve": {
            "routeName": "routes.route_long_name.replace(/\\s/g, '_')",
            "direction": "trips.trip_headsign.replace(/\\s/g, '_')",
            "tripStartTime": "format(trips.startTime, 'yyyyMMdd\\'T\\'HHmm')",
            "depStop": "connection.departureStop.stop_code",
            "depTime": "format(connection.departureTime, 'yyyyMMdd\\'T\\'HHmm')",
            "arrStop": "connection.arrivalStop.stop_code"
        }
    }
};

let server;
let historyDB;
let indexes;

jest.setTimeout(30000);

beforeAll(async () => {
    // Setup mock target server
    server = fastify({ logger: false });
    // Add support for N-Triples
    server.addContentTypeParser(
        "application/n-triples",
        { parseAs: 'string' },
        function (req, body, done) {
            done(null, body);
        }
    );

    await server.register(async (fstfy) => {
        fstfy.post("/*", async (request, reply) => {
            reply.send("OK");
        });
    });

    await server.listen({ port: 3001, host: "0.0.0.0" });
});

afterAll(async () => {
    // Clean up
    server.close();
    await cleanUp();
});

test("Process GTFS file for the first time (should produce a total of 201 connections)", async () => {
    config["gtfs"]["source"] = "./test/data/delijn.test.0.zip";
    const { count, failed } = await processGTFS(config);
    expect(count).toBe(201);
    expect(failed).toBe(0);
    await cleanOutput();
});

test("Process second GTFS file (should only produce 6 new connections due to historic records)", async () => {
    config["gtfs"]["source"] = "./test/data/delijn.test.1.zip";
    const { count, failed } = await processGTFS(config);
    expect(count).toBe(6);
    expect(failed).toBe(0);
    await cleanOutput();
});

test("Process first GTFS-realtime update (should update only 1 connection with delays)", async () => {
    // Build static indexes
    const idxs = await getIndexes();
    const history = await getHistoryDB();
    idxs.historyDB = history;
    // Process GTFS-realtime update
    config["gtfs_realtime"]["source"] = "./test/data/delijn-realtime.0.pbf";
    const { count, failed } = await processGTFSRealtime(config, idxs);
    // Get connection we expect to be updated
    const updatedConn = await history.get("Turnhout-Herentals-Herselt-Leuven/59/102827/106231/13:10:00/15:04:00/15:05:00/0/0");

    expect(count).toBe(1);
    expect(failed).toBe(0);
    expect(updatedConn['20220707'].departureDelay).toBe(713);
    expect(updatedConn['20220707'].arrivalDelay).toBe(713);
});

test("Process second GTFS-realtime update (should update only 1 connection with different delays)", async () => {
    // Build static indexes
    const idxs = await getIndexes();
    const history = await getHistoryDB();
    idxs.historyDB = history;
    // Process GTFS-realtime update
    config["gtfs_realtime"]["source"] = "./test/data/delijn-realtime.1.pbf";
    const { count, failed } = await processGTFSRealtime(config, idxs);
    // Get connection we expect to be updated
    const updatedConn = await history.get("Turnhout-Herentals-Herselt-Leuven/59/102827/106231/13:10:00/15:04:00/15:05:00/0/0");

    expect(count).toBe(1);
    expect(failed).toBe(0);
    expect(updatedConn['20220707'].departureDelay).toBe(744);
    expect(updatedConn['20220707'].arrivalDelay).toBe(744);
    await cleanUp();
});

// Function to get set of static indexes
async function getIndexes() {
    if (!indexes) {
        indexes = await buildIndexes(config);
    }

    return indexes;
}

// Function to get reference to historic records
async function getHistoryDB() {
    if (!historyDB) {
        historyDB = await new Level("./test/data/history.db", { valueEncoding: "json" });
    }
    await historyDB.open();
    return historyDB;
}

async function cleanOutput() {
    await deleteAsync(["./test/data/linkedConnections.json.gz"]);
}

async function cleanUp() {
    await deleteAsync([
        "./test/data/*.txt",
        "./test/data/history.db",
        "./test/data/linkedConnections.json.gz"
    ], { force: true });
}