/* tslint:disable */
/* eslint-disable */

/**
 * Parse `.it` source into an IntentDocument JS object.
 */
export function parse_wasm(source: string): any;

/**
 * Render HTML from an IntentDocument JS object.
 */
export function render_wasm(document: any): string;

/**
 * Convert an IntentDocument JS object back to `.it` source.
 */
export function to_source_wasm(document: any): string;

/**
 * Validate an IntentDocument JS object and return diagnostics array.
 */
export function validate_wasm(document: any): any;
