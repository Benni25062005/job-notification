import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) check(path);
    else if (/\.(m?js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
['src', 'api', 'scripts', 'tests'].forEach(check);
console.log('Syntaxprüfung erfolgreich.');
