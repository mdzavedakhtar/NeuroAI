import type { AiTool } from "./tool.interface"
import { SummarizerTool } from "./summarizer.tool"
import { RagSearchTool } from "./rag-search.tool"
import { BugDetectorTool } from "./bug-detector.tool"
import { TestGeneratorTool } from "./test-generator.tool"
import { DataAnalyzerTool } from "./data-analyzer.tool"
import { ContentRewriterTool } from "./content-rewriter.tool"
import { TranslatorTool } from "./translator.tool"
import { EmailComposerTool } from "./email-composer.tool"
import { CodeExplainerTool } from "./code-explainer.tool"
import { GraphQueryTool } from "./graph-query.tool"

const tools: Map<string, AiTool> = new Map()

// Register all 10 tools
const summarizer = new SummarizerTool()
tools.set(summarizer.name, summarizer)

const ragSearch = new RagSearchTool()
tools.set(ragSearch.name, ragSearch)

const bugDetector = new BugDetectorTool()
tools.set(bugDetector.name, bugDetector)

const testGenerator = new TestGeneratorTool()
tools.set(testGenerator.name, testGenerator)

const dataAnalyzer = new DataAnalyzerTool()
tools.set(dataAnalyzer.name, dataAnalyzer)

const contentRewriter = new ContentRewriterTool()
tools.set(contentRewriter.name, contentRewriter)

const translator = new TranslatorTool()
tools.set(translator.name, translator)

const emailComposer = new EmailComposerTool()
tools.set(emailComposer.name, emailComposer)

const codeExplainer = new CodeExplainerTool()
tools.set(codeExplainer.name, codeExplainer)

const graphQuery = new GraphQueryTool()
tools.set(graphQuery.name, graphQuery)

/** Retrieves a registered tool by its unique name descriptor */
export function getTool(name: string): AiTool | undefined {
  return tools.get(name.toLowerCase())
}

/** Lists all registered tool names and descriptions for workspace listing */
export function listTools() {
  return Array.from(tools.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
}
