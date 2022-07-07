import fastify from "fastify";
import fs from "fs";
import del from "del";
import { processGTFS } from "../lib/GTFS.js";
import { request } from "undici";

// Mock config
const config = {
    "general": {
        "data_folder": "./test/data",
        "target_url": "http://localhost:8080/test",
        "throttle_rate": 5
    },
    "gtfs": {},
    "@context": {
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "dct": "http://purl.org/dc/terms/",
        "prov": "http://www.w3.org/ns/prov#",
        "lc": "http://semweb.mmlab.be/ns/linkedconnections#",
        "gtfs": "http://vocab.gtfs.org/terms#",
        "gtfs:trip": { "@type": "@id" },
        "gtfs:route": { "@type": "@id" },
        "gtfs:pickupType": { "@type": "@id" },
        "gtfs:dropOffType": { "@type": "@id" },
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
        "connection": "https://data.delijn.be/connections/{routeName}/{direction}/{trips.startTime(yyyyMMdd\\'T\\'HHmm)}/{depStop}/",
        "trip": "https://data.delijn.be/trips/{routeName}/{direction}/{trips.startTime(yyyyMMdd\\'T\\'HHmm)}",
        "route": "https://data.delijn.be/routes/{routeName}",
        "resolve": {
            "routeName": "routes.route_long_name.replace(/\\s/g, '_')",
            "depStop": "connection.departureStop.stop_code",
            "direction": "trips.trip_headsign.replace(/\\s/g, '_')"
        }
    }
};

beforeAll(async () => {
    // Setup mock target server
    const server = fastify({ logger: true });
    server.register((fstfy) => {
        fstfy.post("/*", async (request, reply) => {
            reply.send("OK");
        });
    });
    
    server.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
        if (err) {
            server.log.error(err)
            process.exit(1)
        }
        console.log(`server listening on ${address}`);
    });
});

test("Process GTFS file for the first time", async () => {
    expect.assertions(2);
    config["gtfs"].source = "./test/data/delijn.test.0.zip";
    const { count, failed } = await processGTFS(config);
    expect(count).toBe(60);
    expect(failed).toBe(0);
});

test("Process second GTFS file which only should produce 2 new connections", async () => {
    expect.assertions(2);
    config["gtfs"].source = "./test/data/delijn.test.1.zip";
    const { count, failed } = await processGTFS(config);
    expect(count).toBe(2);
    expect(failed).toBe(0);
    await cleanUp();
});

async function cleanUp() {
    await del([
        "./test/data/*.txt",
        "./test/data/history.db",
        "./test/data/linkedConnections.json"
    ], { force: true });
}