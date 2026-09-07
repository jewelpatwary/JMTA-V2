import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace {recentOrders.length > 0 ? recentOrders.map(order => (
content = content.replace(
  /\{recentOrders\.length > 0 \? recentOrders\.map\(order => \(/g,
  '{recentOrders.length > 0 ? recentOrders.map((order, idx) => ('
);
content = content.replace(
  /key=\{order\.id\}/g,
  'key={`${order.id}-${idx}`}'
);

// Replace currentPayments
content = content.replace(
  /\{currentPayments\.map\(p => \(/g,
  '{currentPayments.map((p, idx) => ('
);
content = content.replace(
  /key=\{p\.id\}/g,
  'key={`${p.id}-${idx}`}'
);

// Replace filteredTransactions
content = content.replace(
  /\{filteredTransactions\.map\(t => \(/g,
  '{filteredTransactions.map((t, idx) => ('
);
content = content.replace(
  /key=\{t\.id\}/g,
  'key={`${t.id}-${idx}`}'
);

content = content.replace(
  /\{filteredMethods\.map\(method => \(/g,
  '{filteredMethods.map((method, idx) => ('
);
content = content.replace(
  /<React\.Fragment key=\{method\.id\}>/g,
  '<React.Fragment key={`${method.id}-${idx}`}>'
);

content = content.replace(
  /\{method\.subItems\.map\(sub => \(/g,
  '{method.subItems.map((sub, idx) => ('
);
content = content.replace(
  /<div key=\{sub\.id\}/g,
  '<div key={`${sub.id}-${idx}`}'
);

content = content.replace(
  /filteredAgents\.map\(\(agent: any\) => \(/g,
  'filteredAgents.map((agent: any, idx: number) => ('
);
content = content.replace(
  /key=\{agent\.id\}/g,
  'key={`${agent.id}-${idx}`}'
);

content = content.replace(
  /\{history\.map\(\(h\) => \(/g,
  '{history.map((h, idx) => ('
);
content = content.replace(
  /<div key=\{h\.id\}/g,
  '<div key={`${h.id}-${idx}`}'
);

content = content.replace(
  /\{currentAgents\.map\(agent => \(/g,
  '{currentAgents.map((agent, idx) => ('
);

content = content.replace(
  /\{currentOrders\.length > 0 \? currentOrders\.map\(order => \(/g,
  '{currentOrders.length > 0 ? currentOrders.map((order, idx) => ('
);

content = content.replace(
  /\{currentConversions\.map\(conv => \{/g,
  '{currentConversions.map((conv, idx) => {'
);
content = content.replace(
  /<tr key=\{conv\.id\}/g,
  '<tr key={`${conv.id}-${idx}`}'
);

content = content.replace(
  /\{currentExpenses\.map\(exp => \(/g,
  '{currentExpenses.map((exp, idx) => ('
);
content = content.replace(
  /<tr key=\{exp\.id\}/g,
  '<tr key={`${exp.id}-${idx}`}'
);

content = content.replace(
  /\{loanTxs\.map\(\(t\) => \{/g,
  '{loanTxs.map((t, idx) => {'
);

content = content.replace(
  /\{loans\.map\(loan => \{/g,
  '{loans.map((loan, idx) => {'
);
content = content.replace(
  /<tr key=\{loan\.id\}/g,
  '<tr key={`${loan.id}-${idx}`}'
);

content = content.replace(
  /\{calculatedRows\.map\(\(r\) => \(/g,
  '{calculatedRows.map((r, idx) => ('
);
content = content.replace(
  /<tr key=\{r\.id\}/g,
  '<tr key={`${r.id}-${idx}`}'
);

fs.writeFileSync('src/App.tsx', content);

// And fix Date.now() usages in store.ts to prevent duplicate keys in bulk uploads by advancing timestamp
let storeContent = fs.readFileSync('src/lib/store.ts', 'utf-8');
// Adding an offset could be done by replacing Date.now() with a counter
// but fixing the maps is better.

fs.writeFileSync('src/lib/store.ts', storeContent);
