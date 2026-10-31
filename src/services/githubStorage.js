const config = require('../config');

class GitHubStorage {
  constructor() {
    this.token = config.GITHUB.TOKEN;
    this.owner = config.GITHUB.OWNER;
    this.repo = config.GITHUB.REPO;
    this.apiBase = config.GITHUB.API_URL;
    // ইন-মেমোরি ক্যাশ (Render চলাকালীন পারফরম্যান্স বৃদ্ধির জন্য)
    this.cache = new Map();
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'NurHost-Storage-Engine'
    };
  }

  // গিটহাব থেকে ফাইল এবং তার SHA রিট্রিভ করা
  async getFile(path) {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    } catch (err) {
      console.error(`Error reading ${path}:`, err.message);
      throw err;
    }
  }

  // গিটহাবে ফাইল সেভ বা আপডেট করা
  async saveFile(path, contentString, message = 'Update file') {
    const existing = await this.getFile(path);
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;
    const payload = {
      message: `[NurHost] ${message}`,
      content: Buffer.from(contentString, 'utf-8').toString('base64'),
      branch: 'main'
    };

    if (existing && existing.sha) {
      payload.sha = existing.sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to save file to GitHub: ${response.status} ${errBody}`);
    }

    const result = await response.json();
    return result;
  }

  // ফাইল মুছে ফেলা
  async deleteFile(path, message = 'Delete file') {
    const existing = await this.getFile(path);
    if (!existing) return true;

    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;
    const payload = {
      message: `[NurHost] ${message}`,
      sha: existing.sha,
      branch: 'main'
    };

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    return response.ok;
  }

  // ইউজার ও ওয়েবসাইট ইনডেক্সিং হেল্পার
  async getIndex(name) {
    const file = await this.getFile(`platform/${name}.json`);
    if (!file) return {};
    try {
      return JSON.parse(file.content);
    } catch (e) {
      return {};
    }
  }

  async saveIndex(name, data) {
    return await this.saveFile(`platform/${name}.json`, JSON.stringify(data, null, 2), `Update ${name} index`);
  }
}

module.exports = new GitHubStorage();
