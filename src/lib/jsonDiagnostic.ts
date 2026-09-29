/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeSnippetLine {
  lineNum: number;
  text: string;
  isError: boolean;
}

export interface JsonDiagnosticError {
  line: number;
  column: number;
  message: string;
  hint?: string;
  type: 'syntax' | 'schema';
  snippet: CodeSnippetLine[];
  pointerCol: number;
}

export interface JsonDiagnosticResult {
  valid: boolean;
  parsed?: any;
  error?: JsonDiagnosticError;
  totalLines: number;
  totalResources: number;
}

/**
 * Locate exact line and column from JSON error message or position
 */
function findErrorLocation(
  rawText: string,
  errMsg: string
): { line: number; column: number; offset: number } {
  // 1. Try explicit line & column from modern V8 engines: e.g. "at position 42 (line 3 column 5)"
  const lineColMatch = errMsg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    const line = parseInt(lineColMatch[1], 10);
    const column = parseInt(lineColMatch[2], 10);
    // Find offset
    const lines = rawText.split('\n');
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for \n
    }
    offset += Math.max(0, column - 1);
    return { line, column, offset };
  }

  // 2. Try position match: e.g. "at position 145"
  const posMatch = errMsg.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = Math.min(rawText.length, parseInt(posMatch[1], 10));
    const before = rawText.slice(0, pos);
    const lines = before.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column, offset: pos };
  }

  // 3. Try token or snippet match
  const tokenMatch =
    errMsg.match(/Unexpected token '([^']+)'/i) ||
    errMsg.match(/\"([^\"]+)\"\s+is not valid JSON/i);
  if (tokenMatch) {
    const token = tokenMatch[1];
    const idx = rawText.indexOf(token);
    if (idx !== -1) {
      const before = rawText.slice(0, idx);
      const lines = before.split('\n');
      return { line: lines.length, column: lines[lines.length - 1].length + 1, offset: idx };
    }
  }

  // 4. Fallback scan for common malformed patterns
  const lines = rawText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Check for single quotes
    if (l.includes("'") && !l.includes('"')) {
      return { line: i + 1, column: l.indexOf("'") + 1, offset: 0 };
    }
    // Check for trailing comma before } or ]
    if (/,\s*[\}\]]/.test(l)) {
      return { line: i + 1, column: l.indexOf(',') + 1, offset: 0 };
    }
  }

  return { line: 1, column: 1, offset: 0 };
}

/**
 * Generate human-friendly hints based on the error line and error message
 */
function generateHint(
  errorLineText: string,
  errMsg: string,
  rawText: string,
  allLines: string[],
  lineIndex: number
): string {
  const trimmed = errorLineText.trim();
  const prevLine = lineIndex > 0 ? allLines[lineIndex - 1].trim() : '';

  // 1. Check for trailing comma before } or ]
  if (
    /,\s*[\}\]]/.test(errorLineText) ||
    ((trimmed.startsWith('}') || trimmed.startsWith(']')) && prevLine.endsWith(','))
  ) {
    return 'Trailing comma detected before a closing brace or bracket. Remove the trailing comma from the previous line.';
  }

  // 2. Check for single quotes
  if (trimmed.includes("'") || (prevLine && prevLine.includes("'"))) {
    return 'Single quotes (\') detected. JSON syntax strictly requires double quotes (") for keys and string values.';
  }

  // 3. Unquoted values (e.g. "size": Standard_B1s)
  if (
    errMsg.includes('Unexpected token') &&
    /:\s*[a-zA-Z_][a-zA-Z0-9_]*/.test(errorLineText) &&
    !/:\s*(true|false|null)/.test(errorLineText)
  ) {
    return 'Unquoted string literal detected. String values in JSON must be enclosed in double quotes (e.g. "Standard_D2s_v3").';
  }

  // 4. Unquoted object keys (e.g. size: "Standard_B1s")
  if (
    errMsg.includes('Expected double-quoted property name') ||
    /^\s*[a-zA-Z0-9_]+\s*:/.test(errorLineText)
  ) {
    return 'Object key is not enclosed in double quotes. Example: use "resource_changes" instead of resource_changes.';
  }

  // 5. Missing comma
  if (errMsg.includes("Expected ','") || errMsg.includes('after property value')) {
    return 'Missing comma (,) separating properties or array elements on this line or the preceding line.';
  }

  // 6. Bad string literal
  if (errMsg.includes('Bad control character in string literal')) {
    return 'Unclosed string literal. Check for a missing closing double quote (") before the end of the line.';
  }

  // 7. Comments
  if (trimmed.includes('//') || trimmed.includes('/*')) {
    return 'Comments are not supported in standard JSON. Remove comment markers (// or /* */).';
  }

  return 'Verify that all brackets are balanced and keys/strings use standard double quotes (").';
}

/**
 * Build 3-5 line code context snippet around the error line
 */
function buildSnippet(lines: string[], targetLine: number): CodeSnippetLine[] {
  const snippet: CodeSnippetLine[] = [];
  const start = Math.max(0, targetLine - 3); // 2 lines before
  const end = Math.min(lines.length - 1, targetLine + 1); // 2 lines after

  for (let i = start; i <= end; i++) {
    snippet.push({
      lineNum: i + 1,
      text: lines[i] || '',
      isError: i + 1 === targetLine,
    });
  }

  return snippet;
}

/**
 * Find line number of a semantic entity in the raw text
 */
function findLineOfText(rawText: string, searchSubstr: string, fromIndex = 0): { line: number; column: number } {
  const idx = rawText.indexOf(searchSubstr, fromIndex);
  if (idx === -1) {
    return { line: 1, column: 1 };
  }
  const before = rawText.slice(0, idx);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Comprehensive JSON & Terraform Plan Validator
 */
export function validateTerraformPlanJson(rawText: string): JsonDiagnosticResult {
  const trimmed = rawText.trim();
  const allLines = rawText.split('\n');
  const totalLines = allLines.length;

  if (!trimmed) {
    return {
      valid: false,
      totalLines: 0,
      totalResources: 0,
      error: {
        line: 1,
        column: 1,
        type: 'syntax',
        message: 'Plan input is completely empty.',
        hint: 'Paste a valid Terraform Plan JSON or click "Load Demo Plan" to begin.',
        snippet: [{ lineNum: 1, text: '', isError: true }],
        pointerCol: 1,
      },
    };
  }

  // 1. Syntactic JSON Validation
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (syntaxErr: any) {
    const errMsg = syntaxErr.message || 'Syntax error in JSON';
    const loc = findErrorLocation(rawText, errMsg);
    const targetLineIdx = Math.max(0, Math.min(allLines.length - 1, loc.line - 1));
    const errorLineText = allLines[targetLineIdx] || '';
    const hint = generateHint(errorLineText, errMsg, rawText, allLines, targetLineIdx);
    const snippet = buildSnippet(allLines, loc.line);

    return {
      valid: false,
      totalLines,
      totalResources: 0,
      error: {
        line: loc.line,
        column: loc.column,
        type: 'syntax',
        message: `Syntax Error at Line ${loc.line}, Col ${loc.column}: ${errMsg}`,
        hint,
        snippet,
        pointerCol: loc.column,
      },
    };
  }

  // 2. Terraform Plan Schema Validation
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const loc = { line: 1, column: 1 };
    return {
      valid: false,
      totalLines,
      totalResources: 0,
      error: {
        line: 1,
        column: 1,
        type: 'schema',
        message: 'Root must be a valid JSON Object (e.g. { "format_version": "1.2", "resource_changes": [...] })',
        hint: 'Ensure your plan begins with "{" and contains the top-level keys produced by "terraform show -json".',
        snippet: buildSnippet(allLines, 1),
        pointerCol: 1,
      },
    };
  }

  if (!('resource_changes' in parsed)) {
    return {
      valid: false,
      totalLines,
      totalResources: 0,
      error: {
        line: 1,
        column: 1,
        type: 'schema',
        message: 'Missing required "resource_changes" array.',
        hint: 'A valid Terraform plan JSON requires a top-level "resource_changes": [...] array. Check if this is the output of "terraform show -json".',
        snippet: buildSnippet(allLines, 1),
        pointerCol: 1,
      },
    };
  }

  if (!Array.isArray(parsed.resource_changes)) {
    const loc = findLineOfText(rawText, '"resource_changes"');
    return {
      valid: false,
      totalLines,
      totalResources: 0,
      error: {
        line: loc.line,
        column: loc.column,
        type: 'schema',
        message: `"resource_changes" must be a JSON Array, found ${typeof parsed.resource_changes}.`,
        hint: 'Change "resource_changes" to an array [...] of resource change objects.',
        snippet: buildSnippet(allLines, loc.line),
        pointerCol: loc.column,
      },
    };
  }

  // Validate items inside resource_changes
  for (let i = 0; i < parsed.resource_changes.length; i++) {
    const item = parsed.resource_changes[i];
    const prefix = `resource_changes[${i}]`;

    if (typeof item !== 'object' || item === null) {
      const loc = findLineOfText(rawText, '"resource_changes"');
      return {
        valid: false,
        totalLines,
        totalResources: parsed.resource_changes.length,
        error: {
          line: loc.line,
          column: loc.column,
          type: 'schema',
          message: `${prefix} is not a valid object.`,
          hint: 'Each item inside "resource_changes" must be an object containing address, type, and change.',
          snippet: buildSnippet(allLines, loc.line),
          pointerCol: loc.column,
        },
      };
    }

    // Check address
    if (!item.address || typeof item.address !== 'string') {
      const loc = findLineOfText(rawText, JSON.stringify(item.name || item.type || ''));
      return {
        valid: false,
        totalLines,
        totalResources: parsed.resource_changes.length,
        error: {
          line: loc.line,
          column: loc.column,
          type: 'schema',
          message: `Malformed resource: ${prefix} is missing a valid "address" string.`,
          hint: 'Every resource change must specify an "address" attribute (e.g. "azurerm_linux_virtual_machine.app").',
          snippet: buildSnippet(allLines, loc.line),
          pointerCol: loc.column,
        },
      };
    }

    const itemAddressLoc = findLineOfText(rawText, `"${item.address}"`);

    // Check type
    if (!item.type || typeof item.type !== 'string') {
      return {
        valid: false,
        totalLines,
        totalResources: parsed.resource_changes.length,
        error: {
          line: itemAddressLoc.line,
          column: itemAddressLoc.column,
          type: 'schema',
          message: `Malformed resource "${item.address}": missing required "type" field.`,
          hint: 'Specify the Terraform resource type (e.g. "azurerm_linux_virtual_machine", "azurerm_managed_disk").',
          snippet: buildSnippet(allLines, itemAddressLoc.line),
          pointerCol: itemAddressLoc.column,
        },
      };
    }

    // Check change object
    if (!item.change || typeof item.change !== 'object') {
      return {
        valid: false,
        totalLines,
        totalResources: parsed.resource_changes.length,
        error: {
          line: itemAddressLoc.line,
          column: itemAddressLoc.column,
          type: 'schema',
          message: `Malformed resource "${item.address}": missing "change" object.`,
          hint: 'Each resource requires a "change" block with "actions", and optional "before" / "after" states.',
          snippet: buildSnippet(allLines, itemAddressLoc.line),
          pointerCol: itemAddressLoc.column,
        },
      };
    }

    // Check actions array
    if (!item.change.actions || !Array.isArray(item.change.actions)) {
      return {
        valid: false,
        totalLines,
        totalResources: parsed.resource_changes.length,
        error: {
          line: itemAddressLoc.line,
          column: itemAddressLoc.column,
          type: 'schema',
          message: `Malformed resource "${item.address}": "change.actions" must be an array (e.g. ["create"], ["update"], ["delete"], or ["no-op"]).`,
          hint: 'Provide an actions array indicating the planned lifecycle action for this resource.',
          snippet: buildSnippet(allLines, itemAddressLoc.line),
          pointerCol: itemAddressLoc.column,
        },
      };
    }
  }

  // All valid!
  return {
    valid: true,
    parsed,
    totalLines,
    totalResources: parsed.resource_changes.length,
  };
}
