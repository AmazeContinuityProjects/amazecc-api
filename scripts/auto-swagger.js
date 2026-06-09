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

  // Strip existing openapi block if it exists (so we can regenerate)
  let blockStart = content.indexOf('/**\n * @openapi');
  if (blockStart === -1) {
      blockStart = content.indexOf('/**\r\n * @openapi');
  }
  if (blockStart !== -1) {
      const blockEnd = content.indexOf('*/', blockStart);
      if (blockEnd !== -1) {
          content = content.substring(0, blockStart) + content.substring(blockEnd + 2);
      }
  }

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
      // Split into lines safely
      const lines = content.split('\n');
      let allFields = new Set();
      
      // Some files use const body = await req.json() but we might not easily infer. 
      // VTOP specific fallback:
      if (apiEndpoint.includes('/attendance') || apiEndpoint.includes('/grades') || apiEndpoint.includes('/calendar') || apiEndpoint.includes('/schedule') || apiEndpoint.includes('/hostel') || apiEndpoint.includes('/all-grades')) {
          allFields.add('cookies');
          allFields.add('authorizedID');
          allFields.add('csrf');
          if (!apiEndpoint.includes('/hostel') && !apiEndpoint.includes('/all-grades')) {
              allFields.add('semesterId');
          }
      }

      for (const line of lines) {
         if (line.includes('req.json')) {
            if ((line.includes('const {') || line.includes('let {')) && line.includes('}')) {
                const start = line.indexOf('{');
                const end = line.indexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    const fieldsStr = line.substring(start + 1, end);
                    const fields = fieldsStr.split(',').map(f => f.trim().split(':')[0].split('=')[0].trim()).filter(f => f);
                    fields.forEach(f => allFields.add(f));
                }
            }
         }
      }

      if (allFields.size > 0) {
        swaggerDocs += ` *     requestBody:\n *       required: true\n *       content:\n *         application/json:\n *           schema:\n *             type: object\n *             properties:\n`;
        for (const field of allFields) {
          swaggerDocs += ` *               ${field}:\n *                 type: string\n`;
        }
      } else {
        // Fallback for body/json
        if (content.includes('await req.json()')) {
            swaggerDocs += ` *     requestBody:\n *       required: true\n *       content:\n *         application/json:\n *           schema:\n *             type: object\n`;
        }
      }
    }

    swaggerDocs += ` *     responses:\n *       200:\n *         description: Successful response\n *         content:\n *           application/json:\n *             schema:\n *               type: object\n`;
    swaggerDocs += ` *       400:\n *         description: Bad Request\n`;
    swaggerDocs += ` *       401:\n *         description: Unauthorized\n`;
    swaggerDocs += ` *       500:\n *         description: Internal Server Error\n`;
  }

  swaggerDocs += ` */\n\n`;

  const exportIndex = content.search(/export (const|async function|function)/);
  if (exportIndex !== -1) {
    content = content.slice(0, exportIndex) + swaggerDocs + content.slice(exportIndex);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated JSDoc for ${apiEndpoint}`);
  }
}

processDirectory(apiDir);
