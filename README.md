# gtfs2ldes-js

[![Node.js CI](https://github.com/julianrojas87/gtfs2ldes-js/actions/workflows/build-test.yml/badge.svg)](https://github.com/linkedconnections/gtfsrt2lc/actions/workflows/build-test.yml) [![Coverage Status](https://coveralls.io/repos/github/julianrojas87/gtfs2ldes-js/badge.svg?branch=main)](https://coveralls.io/github/julianrojas87/gtfs2ldes-js?branch=main)

Node.js application to perform (differential) update processing of GTFS and GTFS-realtime sources towards [LDES (Linked Data Event Stream)](https://semiceu.github.io/LinkedDataEventStreams/) publishing.

## How does it work?

This application will periodically (based on configuration) fetch GTFS and GTFS-realtime data sources from a public transit operator and produce a set of versioned [Linked Connections](https://linkedconnections.org) (LCs) entities, which are meant to be ingested into an LDES server.

The produced LCs will be sent via HTTP POST requests to a configured LDES ingestion endpoint. Connections will be formatted using the [`N-Triples`](https://www.w3.org/TR/n-triples/) RDF serialization format. An example of a produced LC is as follows (shown in turtle for readability):

```turtle
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>
@prefix dct: <http://purl.org/dc/terms/>
@prefix prov: <http://www.w3.org/ns/prov#>
@prefix lc: <http://semweb.mmlab.be/ns/linkedconnections#>
@prefix gtfs: <http://vocab.gtfs.org/terms#>

<https://example.org/connections/A#2022-07-08T14:34:47.463Z> a lc:Connection ;
	dct:isVersionOf <https://ex.org/connections/A> ;
	prov:generatedAtTime "2022-07-08T14:34:47.463Z"^^xsd:dateTime ;
	lc:departureStop <https://www.delijn.be/nl/haltes/halte/101908> ;
	lc:arrivalStop <https://www.delijn.be/nl/haltes/halte/101916> ;
	lc:departureTime "2022-07-09T10:21:00.000Z"^^xsd:dateTime ;
	lc:arrivalTime "2022-07-09T10:22:00.000Z"^^xsd:dateTime ;
	gtfs:dropOffType gtfs:Regular ;
	gtfs:pickupType gtfs:Regular ;
	gtfs:route <https://example.org/routes/Hoboken-Wijnegem> .
	gtfs:trip <https://data.delijn.be/trips/Hoboken-Wijnegem/20220709T0953> .
```

#### Important note:

The application needs to start by processing a GTFS source first, before processing GTFS-realtime updates. For this reason the `RUN_ON_LAUNCH` configuration variable **must** be set to `true` the first time (see more info below). 

### Differential updates

The application relies on the [gtfs2lc](https://github.com/linkedconnections/gtfs2lc) and [gtfsrt2lc](https://github.com/linkedconnections/gtfsrt2lc) libraries to produce LCs from GTFS and GTFS-realtime respectively. Furthermore, these 2 libraries have been extended to produce differential updates. This means that when processing consecutive GTFS or GTFS-realtime sources, only those LCs that have changed or are completely new will be emitted.

These libraries are able to keep track of all the LCs that have been emitted so far by relying on a Key-Value data store, namely a [level](https://github.com/Level/level) store. Both libraries can create/reuse a level store named `history.db` and use it across executions. 

For efficient data storage use, they do not persist every LC individually. Instead a unique ID is given to every connection rule, which is stored together with all the service operation dates and delays (if any). A connection rule is for example the following: 

​		A bus from route `Route0` and trip `Trip1` departs from `stop1` at `t0`, arriving to `stop2` at `t1` and it 		can pick up (`regular`) and drop-off (`regular`) passengers normally at both stops.

The above connection rule would produce the following unique identifier (`key`): 

```
Route0/Trip1/stop1/stop2/t0/t1/regular/regular
```

Assuming that this connection rule is scheduled to run on `2022-07-01`, `2022-07-02` and `2022-07-03`, we then store the following `value` in `history.db`:

```json
{
    "20220701": { "type": "Connection", "departureDelay": 0, "arrivalDelay": 0},
    "20220702": { "type": "Connection", "departureDelay": 0, "arrivalDelay": 0},
    "20220703": { "type": "Connection", "departureDelay": 0, "arrivalDelay": 0},
}
```

When any of the parameters used to produce the `key` change a new LC is produced. Also when new service dates or delay reports are given, the respective LCs are emitted while persisting the information in `history.db`. 

## Run with Docker

This application can be run within a docker container, following these steps:

1. Make sure to have a recent version of [Docker](https://docs.docker.com/engine/install/) installed.

2.  Build the docker image:

   ```bash
   docker build -t gtfs2ldes-js .
   ```

3. Set configuration variables in a file. For example a `conf.env` may contain:

   ``` bash
   RUN_ON_LAUNCH=true # Determines if the GTFS processing is kicked-off upon app's start.
   
   TARGET_URL=http://192.168.1.4:8080/test # LDES server ingestion endpoint
   
   THROTTLE_RATE=1000 # Amount of simoultaneous HTTP POST request expected to be handled by the target server
   
   GTFS_SOURCE=/data/delijn.200-07-07.zip # Location of the GTFS source. It can be a local file or a remote URL.
   
   GTFS_CRON=0 0 3 * * * # Cron expression of how often the GTFS source will be processed. In this example it will be processed every day at 03:00 AM
   
   GTFSRT_SOURCE=https://api.delijn.be/gtfs/v1/realtime # Location of the GTFS-RT source. It can be a local file or a remote URL.
   
   GTFSRT_CRON=*/30 * * * * * # Cron expression of how often the GTFS source will be processed. In this example it will be processed every 30 seconds.
   
   AUTH_HEADER=Ocp-Apim-Subscription-Key # Optional HTTP header name for making requests on a GTFS-RT API. For example as required by De Lijn (https://data.delijn.be/docs/services/)
   
   AUTH_HEADER_VALUE=cf97c65afbe84e0c8e20142f4cb62119 # Optional HTTP header value.

   BASE_IRI=http://example.org/ # Base entity IRI used to build unique identifiers for connections, trips, stops, etc. Make sure to always use a trail slash. 
   ```

4. Prepare a folder where the application will persist the historic connection records (e.g., `/home/user/gtfs-records`). 

5. Run the docker container:

   ```bash
   docker run --volume=/home/user/gtfs-records:/data --env-file=conf.env gtfs2ldes-js
   ```

## Authors

Julián Rojas - [julianandres.rojasmelendez@ugent.be](mailTo:julianandres.rojasmelendez@ugent.be)
