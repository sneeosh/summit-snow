import {defineConfig} from 'vitest/config'
export default defineConfig({test:{environment:'node',include:['scripts/winter-review/generate.test.ts'],maxWorkers:1,testTimeout:240000}})
