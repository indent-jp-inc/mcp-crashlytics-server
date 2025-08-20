# 🔥 Firebase Crashlytics MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)

A clean, simple **Model Context Protocol (MCP)** server that integrates Firebase Crashlytics with BigQuery for AI-powered crash analysis. Built for use with Claude Code and other MCP-compatible AI assistants.

## ✨ Features

- 🔍 **Simple Tools**: Clean, single-responsibility tools for crash analysis
- 📱 **App Discovery**: Automatically discover all apps in your Firebase project
- 💥 **Fatal Crash Analysis**: Get detailed fatal crashes with stack traces
- 🐛 **ANR Issue Detection**: Analyze Application Not Responding issues
- 🔧 **Easy Setup**: Simple configuration with environment variables
- 🤖 **AI-Optimized**: Structured output perfect for AI analysis and debugging

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Firebase project with Crashlytics enabled
- BigQuery export enabled for Crashlytics
- Google Cloud service account with BigQuery access

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/mcp-crashlytics-server.git
cd mcp-crashlytics-server
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

### Configuration

1. **Create environment file:**
```bash
cp .env.example .env
```

2. **Configure your environment variables:**
```bash
# Google Cloud Service Account (choose one method)
GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/your-service-account.json
# OR base64-encoded: GOOGLE_SERVICE_ACCOUNT_KEY=eyJhbGciOiJIUzI1...

# Your Firebase project settings
BIGQUERY_PROJECT_ID=your-firebase-project-id
BIGQUERY_DATASET_ID=firebase_crashlytics

# Optional: Default limit for crash queries
DEFAULT_CRASH_LIMIT=10
```

### Setup Firebase & BigQuery

1. **Enable Crashlytics BigQuery Export:**
   - Go to Firebase Console → Project Settings → Integrations
   - Enable BigQuery integration for Crashlytics
   - Data will be exported to `firebase_crashlytics` dataset

2. **Create Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to IAM & Admin → Service Accounts
   - Create service account with these roles:
     - `BigQuery Data Viewer`
     - `BigQuery Job User`
   - Download JSON key file

### Register with AI Agents

#### Claude Code
```bash
# Register the MCP server
claude mcp add crashlytics -- node /path/to/mcp-crashlytics-server/dist/index.js

# Verify it's working
claude mcp list
```

#### Cursor
Add to your `.cursorrules` or cursor settings:
```json
{
  "mcpServers": {
    "crashlytics": {
      "command": "node",
      "args": ["/path/to/mcp-crashlytics-server/dist/index.js"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY": "/path/to/your-service-account.json",
        "BIGQUERY_PROJECT_ID": "your-firebase-project-id",
        "BIGQUERY_DATASET_ID": "firebase_crashlytics"
      }
    }
  }
}
```

#### Windsurf
Add to your Windsurf settings or `.windsurfrules`:
```json
{
  "mcp": {
    "servers": {
      "crashlytics": {
        "command": "node",
        "args": ["/path/to/mcp-crashlytics-server/dist/index.js"],
        "env": {
          "GOOGLE_SERVICE_ACCOUNT_KEY": "/path/to/your-service-account.json",
          "BIGQUERY_PROJECT_ID": "your-firebase-project-id", 
          "BIGQUERY_DATASET_ID": "firebase_crashlytics"
        }
      }
    }
  }
}
```

#### Other MCP-Compatible IDEs
For other MCP-compatible tools, add this server configuration:
- **Command**: `node`
- **Args**: `["/path/to/mcp-crashlytics-server/dist/index.js"]` 
- **Environment Variables**: Same as above (.env file values)

## 🛠️ Available Tools

### 1. `list_available_apps`
**Discover all apps** in your Firebase Crashlytics dataset.
- **Parameters**: None
- **Returns**: List of apps with crash counts

```javascript
// Usage in Claude Code/Cursor
"What apps are available in my crashlytics data?"
```

### 2. `get_fatal_crashes` 
**Get fatal crashes** for a specific app.
- **Parameters**: 
  - `app_package` (required): App package name (e.g., "com.example.myapp")
  - `limit` (optional): Number of crashes (1-50, default: 10)

```javascript
// Usage in Claude Code/Cursor  
"Get the 10 most recent fatal crashes for com.example.myapp"
```

### 3. `get_anr_issues`
**Get ANR (Application Not Responding)** issues for a specific app.
- **Parameters**:
  - `app_package` (required): App package name
  - `limit` (optional): Number of issues (1-50, default: 10)

```javascript
// Usage in Claude Code/Cursor
"Show me ANR issues for com.example.myapp, limit to 5"
```

## 📋 Example Usage

Once set up, you can ask Claude Code natural questions like:

```bash
# Discover your apps
"What apps do I have crash data for?"

# Get fatal crashes
"Show me the latest fatal crashes for my Android app"
"Get 5 fatal crashes for com.mycompany.myapp"

# Analyze ANR issues  
"What ANR issues does my app have?"
"Show ANR problems for com.mycompany.myapp from the last week"
```

## 🏗️ Project Structure

```
mcp-crashlytics-server/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── bigquery-client.ts    # BigQuery integration  
│   ├── crash-processor.ts    # Crash data processing
│   ├── impact-analyzer.ts    # Impact analysis
│   └── types.ts             # TypeScript definitions
├── dist/                    # Built JavaScript files
├── package.json
├── tsconfig.json
├── .env.example            # Environment template
└── README.md
```

## 🔧 Development

### Running in Development Mode
```bash
npm run dev
```

### Building
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

## 🐛 Troubleshooting

### Common Issues

**1. "No MCP servers configured"**
- Make sure to register the server: `claude mcp add crashlytics -- node /path/to/dist/index.js`
- Restart Claude Code/Cursor IDE

**2. "Authentication Failed"**
- Verify service account JSON file path is correct
- Ensure service account has BigQuery permissions
- Check project ID matches your Firebase project

**3. "No crashes returned"**
- Confirm Crashlytics BigQuery export is enabled
- Wait 24-48 hours for initial data export
- Verify your app is actually sending crash data

**4. "Table not found"**
- Check that `BIGQUERY_DATASET_ID` is correct (usually `firebase_crashlytics`)
- Ensure crashes exist in your Firebase project
- Verify BigQuery export is working in Firebase Console

### Debug Mode

Enable verbose logging:
```bash
DEBUG=mcp-crashlytics-server npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality  
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security Considerations

- ⚠️ **Never expose service account credentials** in logs or version control
- 🔐 Use **least-privilege permissions** for service accounts
- 🔑 Store credentials securely using environment variables
- 🚫 Add `.env` to `.gitignore` (already included)

## 📚 Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Firebase Crashlytics](https://firebase.google.com/products/crashlytics)
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)

## 💡 Need Help?

- 🐛 **Found a bug?** [Open an issue](https://github.com/your-username/mcp-crashlytics-server/issues)
- 💬 **Have questions?** [Start a discussion](https://github.com/your-username/mcp-crashlytics-server/discussions)
- 🚀 **Want a feature?** [Request it here](https://github.com/your-username/mcp-crashlytics-server/issues/new?template=feature_request.md)

---

**Made with ❤️ for the MCP community**