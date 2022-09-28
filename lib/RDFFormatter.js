import { Transform } from "stream";
import URITemplate from "uri-templates";
import { format } from "date-fns";
import JSONLD from "jsonld";

export const RDFFormatter = (templates, context, timestamp) => {
    // Set to keep track of emited stops and avoid duplicates
    const stopSet = new Set();

    return new Transform({
        readableObjectMode: true,
        writableObjectMode: true,

        async transform(conn, encoding, done) {
            // Get raw connection object
            const obj = conn.value ? conn.value : conn;

            // Make sure date properties are proper Date objects
            alignDateProperties(obj);

            // Process IRI templates
            const stopTemplate = URITemplate(templates["stop"]);
            const routeTemplate = URITemplate(templates["route"]);
            const tripTemplate = URITemplate(templates["trip"]);
            const connectionTemplate = URITemplate(templates["connection"]);

            // Resolve entity IRIs
            const depStopIRI = resolveURI(stopTemplate, obj, templates["resolve"], "departureStop");
            const arrStopIRI = resolveURI(stopTemplate, obj, templates["resolve"], "arrivalStop");
            const tripIRI = resolveURI(tripTemplate, obj, templates["resolve"]);
            const routeIRI = resolveURI(routeTemplate, obj, templates["resolve"]);
            const connectionIRI = resolveURI(connectionTemplate, obj, templates["resolve"]);

            // Create JSON-LD connection object with LDES properties
            const lc = {
                "@id": `${connectionIRI}#${timestamp}`,
                "@type": obj["type"] ? obj["type"] : "Connection",
                "isVersionOf": connectionIRI,
                "generatedAtTime": timestamp,
                "departureStop": depStopIRI,
                "arrivalStop": arrStopIRI,
                "departureTime": obj["departureTime"],
                "arrivalTime": obj["arrivalTime"],
                "gtfs:route": routeIRI,
                "gtfs:trip": tripIRI,
                "gtfs:pickupType": resolveScheduleRelationship(obj["pickup_type"]),
                "gtfs:dropOffType": resolveScheduleRelationship(obj["drop_off_type"])
            };

            // Add stops info if it hasn't been emitted before
            if (!stopSet.has(depStopIRI)) {
                stopSet.add(depStopIRI);
                lc["departureStop"] = {
                    "@id": depStopIRI,
                    "@type": "Stop",
                    "rdfs:label": obj["departureStop"]["stop_name"],
                    "wgs:lat": obj["departureStop"]["stop_lat"],
                    "wgs:long": obj["departureStop"]["stop_lon"],
                    "gsp:asWKT": `POINT (${obj["departureStop"]["stop_lon"]} ${obj["departureStop"]["stop_lat"]})`
                };
            }
            if (!stopSet.has(arrStopIRI)) {
                stopSet.add(arrStopIRI);
                lc["arrivalStop"] = {
                    "@id": arrStopIRI,
                    "@type": "Stop",
                    "rdfs:label": obj["arrivalStop"]["stop_name"],
                    "wgs:lat": obj["arrivalStop"]["stop_lat"],
                    "wgs:long": obj["arrivalStop"]["stop_lon"],
                    "gsp:asWKT": `POINT (${obj["arrivalStop"]["stop_lon"]} ${obj["arrivalStop"]["stop_lat"]})`
                };
            }

            // Convert to NQuads
            const parsed = await JSONLD.toRDF({
                "@context": context,
                ...lc
            }, { format: "application/n-quads" });

            // Emit quads
            this.push(parsed);
            done();
        },
    });
}

function alignDateProperties(obj) {
    if (typeof obj["departureTime"] === "string") {
        obj["departureTime"] = new Date(obj["departureTime"]);
    }
    if (typeof obj["arrivalTime"] === "string") {
        obj["arrivalTime"] = new Date(obj["arrivalTime"]);
    }
    if (typeof obj["trip"]["startTime"] === "string") {
        obj["trip"]["startTime"] = new Date(obj["trip"]["startTime"]);
    }
}

function resolveURI(template, raw, resolve, stopType) {
    let varNames = template.varNames;
    let fillerObj = {};

    for (let v of varNames) {
        fillerObj[v] = resolveValue(v, raw, resolve || {}, stopType);
    }

    return template.fill(fillerObj);
}

function resolveValue(param, connection, resolve, stopType) {
    // Entity objects to be resolved as needed
    const trips = connection.trip;
    const routes = connection.route;
    const stops = stopType ? connection[stopType] : null;

    // try first to resolve using keys in 'resolve' object
    if (resolve[param]) {
        return eval(resolve[param]);
    }

    // GTFS source file and attribute name
    const source = param.split('.')[0];
    const attr = param.split('.')[1];
    // Resolved value
    let value = null;

    switch (source) {
        case 'trips':
            if (attr.indexOf('startTime') >= 0) {
                const dateFormat = attr.match(/\((.*?)\)/)[1];
                value = format(trips.startTime, dateFormat);
            } else {
                value = trips[attr];
            }
            break;
        case 'routes':
            value = routes[attr];
            break;
        case 'stops':
            value = stops[attr];
            break;
        case 'connection':
            if (attr.indexOf('departureTime') >= 0) {
                const dateFormat = attr.match(/\((.*?)\)/)[1];
                value = format(connection.departureTime, dateFormat);
            } else if (attr.indexOf('arrivalTime') >= 0) {
                const dateFormat = attr.match(/\((.*?)\)/)[1];
                value = format(connection.arrivalTime, dateFormat);
            } else {
                value = connection[attr];
            }
            break;
    }

    return value;
}

function resolveScheduleRelationship(value) {
    if (!value || value == 0) {
        return 'gtfs:Regular';
    } else if (value == 1) {
        return 'gtfs:NotAvailable';
    } else if (value == 2) {
        return 'gtfs:MustPhone'
    } else if (value == 3) {
        return 'gtfs:MustCoordinateWithDriver';
    }
}