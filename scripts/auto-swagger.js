const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '../src/app/api');

function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file === 'route.ts') {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if already documented
  if (content.includes('@openapi')) return;

  const routePath = filePath.split('src\\app\\api')[1].replace(/\\route\.ts$/, '').replace(/\\/g, '/');
  const apiEndpoint = `/api${routePath || '/'}`;
  
  const tags = apiEndpoint.split('/')[2] || 'Default';
  const capTags = tags.charAt(0).toUpperCase() + tags.slice(1);

  let swaggerDocs = `/**\n * @openapi\n * ${apiEndpoint}:\n`;

  const methods = [];
  if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('get');
  if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('post');
  if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('put');
  if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('delete');

  if (methods.length === 0) return;

  for (const method of methods) {
    swaggerDocs += ` *   ${method}:\n`;
    swaggerDocs += ` *     tags:\n *       - ${capTags}\n`;
    swaggerDocs += ` *     summary: ${method.toUpperCase()} endpoint for ${apiEndpoint}\n`;

    // Find search params
    const searchParamsRegex = /searchParams\.get\(['"]([^'"]+)['"]\)/g;
    let match;
    const params = new Set();
    while ((match = searchParamsRegex.exec(content)) !== null) {
      params.add(match[1]);
    }

    if (params.size > 0 || apiEndpoint.includes('[')) {
      swaggerDocs += ` *     parameters:\n`;
      
      // Path params
      const pathParams = apiEndpoint.match(/\[(.*?)\]/g) || [];
      for (const pp of pathParams) {
        const pName = pp.replace('[', '').replace(']', '');
        swaggerDocs += ` *       - name: ${pName}\n`;
        swaggerDocs += ` *         in: path\n`;
        swaggerDocs += ` *         required: true\n`;
        swaggerDocs += ` *         schema:\n`;
        swaggerDocs += ` *           type: string\n`;
      }

      // Query params
      for (const param of params) {
        swaggerDocs += ` *       - name: ${param}\n`;
        swaggerDocs += ` *         in: query\n`;
        swaggerDocs += ` *         required: false\n`;
        swaggerDocs += ` *         schema:\n`;
        swaggerDocs += ` *           type: string\n`;
      }
    }

    // Find JSON body for POST/PUT
    if (method === 'post' || method === 'put') {
      const jsonRegex = /const\s+\{\s*([^}]+)\s*\}\s*=\s*await\s*req\.json\(\)/;
      const jsonMatch = content.match(jsonRegex);
      if (jsonMatch) {
        const fields = jsonMatch[1].split(',').map(f => f.trim().split(':')[0].split('=')[0].trim()).filter(f => f);
        swaggerDocs += ` *     requestBody:\n *       required: true\n *       content:\n *         application/json:\n *           schema:\n *             type: object\n`;
        if (fields.length > 0) {
          swaggerDocs += ` *             properties:\n`;
          for (const field of fields) {
            swaggerDocs += ` *               ${field}:\n *                 type: string\n`;
          }
        }
      }
    }

    swaggerDocs += ` *     responses:\n *       200:\n *         description: Successful response\n`;
  }

  swaggerDocs += ` */\n\n`;

  // Prepend to file
  // Find the first export async function or export const dynamic and place it above
  const exportIndex = content.search(/export (const|async function|function)/);
  if (exportIndex !== -1) {
    content = content.slice(0, exportIndex) + swaggerDocs + content.slice(exportIndex);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Added JSDoc to ${apiEndpoint}`);
  }
}

processDirectory(apiDir);
