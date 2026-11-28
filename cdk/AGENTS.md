# AGENTS.md

The CDK app (TypeScript). `bin/identity_provider.ts` creates the `App`; the stack is in
`lib/identity_provider_stack.ts`; `cdk.json` tells the CDK Toolkit how to run it. `lambda/` holds
the sign-in triggers' code, bundled by `NodejsFunction` (esbuild); the tests skip bundling.

## Read the construct docs first

Each service's documentation ships in `aws-cdk-lib` (after `npm ci`). Before writing constructs
for a service, list its README's headings with
`grep -n '^#' node_modules/aws-cdk-lib/<module>/README.md` and read only the sections for the
constructs you use (`sed -n '<start>,<end>p' …`). A missing README is not an error.

## Check your work

- `npm run build`: type-check.
- `npm run lint`: Google TypeScript style with gts (`npm run fix` fixes formatting).
- `npm test`: jest (`test/*_test.ts`) with coverage, at least 90% of lines.
- `npx cdk synth`: synthesize the template.
- `npx cdk deploy` changes a real AWS account: never run it locally.

## Style

Google TypeScript Style Guide: named exports only, `snake_case` file names, single quotes, JSDoc
on exported symbols, no `any`.
