const fs = require('fs');
const path = require('path');

const roots = ['scenes/fight', 'scenes/onlineroom'];
const standaloneScenes = ['scenes/online/onlineroom.tscn', 'scenes/battle/character_selection.tscn', 'scenes/battle/fight.tscn'];
const files = [];
for (const root of roots) {
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (['.gd', '.tscn', '.uid'].includes(path.extname(entry.name))) files.push(full);
    }
  };
  if (fs.existsSync(root)) visit(root);
}
files.push(...standaloneScenes.filter(fs.existsSync));
const backupRoot = path.join('reports', 'uid-backups', new Date().toISOString().replace(/[-:.]/g, ''));
for (const file of [...new Set(files)]) {
  const relative = file.replaceAll(path.sep, '/');
  const backup = path.join(backupRoot, relative);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(file, backup);
  if (file.endsWith('.uid')) {
    fs.unlinkSync(file);
    console.log(`REMOVED_UID_SIDECAR ${relative}`);
    continue;
  }
  const original = fs.readFileSync(file);
  let updated = original;
  if (file.endsWith('.tscn')) {
    updated = updated.toString('utf8')
      .replace(/^(\[gd_scene[^\r\n]*?)\s+uid="uid:\/\/[A-Za-z0-9]+"/m, '$1')
      .replace(/(\[ext_resource[^\r\n]*?path="res:\/\/scenes\/(?:fight|onlineroom)\/[^\r\n]*?)\s+uid="uid:\/\/[A-Za-z0-9]+"/g, '$1');
    updated = Buffer.from(updated, 'utf8');
  }
  if (!updated.equals(original)) fs.writeFileSync(file, updated);
  console.log(`UPDATED ${relative}`);
}
console.log(`BACKUP_ROOT ${backupRoot}`);
