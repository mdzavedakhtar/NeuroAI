import "dotenv/config"
import neo4j, { Driver, Session } from "neo4j-driver"

let _driver: Driver | null = null

// ======================================================
// GET DRIVER (singleton)
// ======================================================

export const getDriver = (): Driver => {
  if (_driver) return _driver

  const uri      = process.env.NEO4J_URI
  const username = process.env.NEO4J_USERNAME
  const password = process.env.NEO4J_PASSWORD

  if (!uri || !username || !password) {
    throw new Error(
      "NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD must be set in .env"
    )
  }

  // Ensure appropriate secure URI protocol is used for AuraDB
  const hasSecureProtocol =
    uri.startsWith("neo4j+s://") ||
    uri.startsWith("neo4j+ssc://") ||
    uri.startsWith("bolt+s://") ||
    uri.startsWith("bolt+ssc://")

  if (!hasSecureProtocol) {
    console.warn(
      `⚠️ [NEO4J] Warning: Connection URI "${uri.split("://")[0]}://" might not be secure enough for Neo4j AuraDB. Recommended: neo4j+s://`
    )
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 10_000,
  })

  return _driver
}

// ======================================================
// GET SESSION
// ======================================================

export const getSession = (): Session => {
  return getDriver().session()
}

// ======================================================
// VERIFY CONNECTIVITY
// ======================================================

export const verifyNeo4jConnection = async (): Promise<void> => {
  const driver = getDriver()
  await driver.verifyConnectivity()
  console.log("✅ Neo4j: Connected to knowledge graph database")
}

// ======================================================
// CLOSE DRIVER
// ======================================================

export const closeNeo4jDriver = async (): Promise<void> => {
  if (_driver) {
    await _driver.close()
    _driver = null
    console.log("Neo4j: Driver closed")
  }
}

// ======================================================
// CREATE GRAPH INDEXES & CONSTRAINTS
// Called once on server startup.
// ======================================================

export const createGraphIndexes = async (): Promise<void> => {
  const session = getSession()

  try {
    // Entity labels
    const entityLabels = [
      "Person",
      "Organization",
      "Technology",
      "Project",
      "Product",
      "Concept",
      "Location",
    ]

    // Constraints: unique (name, userId) per entity type
    for (const label of entityLabels) {
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS FOR (n:${label})
        REQUIRE (n.name, n.userId) IS NODE KEY
      `)
    }

    // Constraints for Document and Chunk
    await session.run(`
      CREATE CONSTRAINT IF NOT EXISTS FOR (d:Document)
      REQUIRE d.documentId IS UNIQUE
    `)

    await session.run(`
      CREATE CONSTRAINT IF NOT EXISTS FOR (c:Chunk)
      REQUIRE c.chunkId IS UNIQUE
    `)

    // Full-text index on entity name for fast lookup
    await session.run(`
      CREATE FULLTEXT INDEX entityNameIndex IF NOT EXISTS
      FOR (n:Person|Organization|Technology|Project|Product|Concept|Location)
      ON EACH [n.name, n.description]
    `)

    console.log("✅ Neo4j: Graph constraints and indexes created")
  } catch (error) {
    // Constraints may already exist on subsequent restarts — log and continue
    console.warn("Neo4j: Index creation warning (may already exist):", (error as Error).message)
  } finally {
    await session.close()
  }
}
