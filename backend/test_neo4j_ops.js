const neo4j = require("neo4j-driver");
require("dotenv").config();

async function runTest() {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    console.error("❌ Error: NEO4J_URI, NEO4J_USERNAME, or NEO4J_PASSWORD is not set in .env");
    process.exit(1);
  }

  // Mask credentials for secure logging
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`[TEST] Connecting to Neo4j at ${maskedUri} with username "${username}"...`);

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    maxConnectionPoolSize: 5,
    connectionAcquisitionTimeout: 5000,
  });

  try {
    console.log("[TEST] Verifying connectivity...");
    await driver.verifyConnectivity();
    console.log("✅ connectivity_verified: Connection established successfully!");

    const session = driver.session();

    // 1. Create one test node
    console.log("[TEST] Creating test node...");
    const createRes = await session.run(
      `
      MERGE (t:TestNode { name: $name, userId: $userId })
      SET t.description = $description, t.created = datetime()
      RETURN t.name AS name, t.description AS description
      `,
      {
        name: "Neo4j AuraDB Test Node",
        userId: "test_verifier",
        description: "Checking write operations",
      }
    );
    const createdNode = createRes.records[0];
    console.log(`✅ node_created: "${createdNode.get("name")}" with description "${createdNode.get("description")}"`);

    // 2. Read the node
    console.log("[TEST] Reading test node...");
    const readRes = await session.run(
      `
      MATCH (t:TestNode { userId: $userId })
      RETURN t.name AS name, t.description AS description
      `,
      { userId: "test_verifier" }
    );
    const readNode = readRes.records[0];
    if (readNode) {
      console.log(`✅ node_read: "${readNode.get("name")}" matched successfully!`);
    } else {
      throw new Error("Test node could not be read back!");
    }

    // 3. Delete the test node
    console.log("[TEST] Deleting test node...");
    await session.run(
      `
      MATCH (t:TestNode { userId: $userId })
      DETACH DELETE t
      `,
      { userId: "test_verifier" }
    );
    console.log("✅ node_deleted: Test node deleted successfully, DB is clean.");

    await session.close();
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test Failed:", error.message);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

runTest();
