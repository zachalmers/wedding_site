const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Sheet {
  constructor(data) { this.data = structuredClone(data); this.writes = 0; }
  getDataRange() { return { getValues: () => structuredClone(this.data) }; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data[0].length; }
  getRange(row, col, rows = 1, cols = 1) {
    return {
      getValues: () => Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => this.data[row - 1 + r]?.[col - 1 + c] ?? '')),
      setValue: (value) => { this.writes++; this.data[row - 1] ||= []; this.data[row - 1][col - 1] = value; },
      setValues: (values) => { this.writes++; values.forEach((values, r) => { this.data[row - 1 + r] ||= []; values.forEach((value, c) => { this.data[row - 1 + r][col - 1 + c] = value; }); }); },
      clearContent: () => { this.writes++; for (let r = 0; r < rows; r++) this.data[row - 1 + r].fill('', col - 1, col - 1 + cols); },
    };
  }
}
function setup() {
  const guests = new Sheet([
    ['householdId','firstName','lastName','email','whatsappPhone','isPlusOne','attending','events','dietary','allergies','mealChoice','updatedAt','table'],
    ['H1','Alex','One','alex@example.com','123','FALSE','yes','haldi, wedding','omnivore','no pork','','old',8],
    ['H1','Blair','Two','','','FALSE','yes','wedding','vegetarian','coconut','','old',8],
    ['H2','Other','Guest','','','FALSE','yes','wedding','vegan','','vegan','old',9],
    ['H1','Small','Baby','','','FALSE','yes','wedding','baby','','','old',8],
  ]);
  const households = new Sheet([['householdId','email','householdLabel','maxPlusOnes','notes','editToken','lastSubmitted','sendInvite','inviteSentAt','inviteStatus','inviteError','lastReminderSentAt','reminderStatus','reminderError'],['H1','alex@example.com','Party',1,'keep notes','token','old','','','','','','','']]);
  const submissions = new Sheet([['submittedAt','householdId','email','notes','payload']]);
  const sheets = { Guests: guests, Households: households, Submissions: submissions };
  const context = vm.createContext({ console, SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (name) => sheets[name] }) }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) } });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../rsvp-backend.gs'), 'utf8'), context);
  const current = () => JSON.parse(JSON.stringify(context.getGuestsByHousehold_(guests, 'H1')));
  const payload = () => ({ email: 'alex@example.com', householdId: 'H1', guests: current().map((guest) => ({ guestKey: guest.guestKey, mealChoice: guest.dietary === 'omnivore' ? 'fish' : guest.dietary === 'baby' ? 'baby' : 'cannelloni', allergies: guest.allergies, previousAllergies: guest.allergies, previousMealChoice: guest.mealChoice })) });
  return { context, guests, households, submissions, current, payload };
}
test('menu visibility: four omnivore, two vegetarian, one vegan and baby', () => {
  const { context } = setup();
  for (const [category, ids] of [['omnivore',['fish','pork','cannelloni','chilacayote']],['vegetarian',['cannelloni','chilacayote']],['veg',['cannelloni','chilacayote']],['vegan',['vegan']],['baby',['baby']],['unknown',[]]]) {
    assert.deepEqual(Array.from(context.mealOptions_(category), (m) => m.id), ids);
  }
});
test('lookup includes existing allergies, identities, menu and meal selections', () => {
  const { context } = setup();
  const lookup = context.lookup_({email:'alex@example.com'});
  assert.equal(lookup.mealSelectionVersion,1);
  assert.equal(lookup.guests[0].allergies,'no pork');
  assert.equal(lookup.guests[2].mealOptions[0].label,'Baby meal');
});
test('meal saving changes only meal, allergies and timestamp for the correct party', () => {
  const { context, guests, households, payload } = setup();
  const before = structuredClone(guests.data);
  const householdBefore = structuredClone(households.data);
  const input = payload(); input.guests[0].allergies = 'no pork; peanuts';
  assert.equal(context.submitMeals_(input).ok,true);
  for (let r = 0; r < before.length; r++) for (let c = 0; c < before[r].length; c++) {
    if ([1,2,4].includes(r) && [9,10,11].includes(c)) continue;
    assert.deepEqual(guests.data[r][c],before[r][c]);
  }
  assert.equal(guests.data[1][9],'no pork; peanuts');
  assert.equal(guests.data[1][10],'fish');
  assert.deepEqual(households.data,householdBefore);
});
test('server rejects meat for vegetarians even if client tampers with dietary', () => {
  const {context,guests,payload}=setup(); const input=payload(); input.guests[1].mealChoice='pork'; input.guests[1].dietary='omnivore';
  assert.throws(()=>context.submitMeals_(input),/available meal/); assert.equal(guests.writes,0);
});
test('server rejects adult meal for baby before any writes', () => {
  const {context,guests,payload}=setup(); const input=payload(); input.guests[2].mealChoice='fish';
  assert.throws(()=>context.submitMeals_(input),/available meal/); assert.equal(guests.writes,0);
});
test('stale allergy and meal changes cannot overwrite newer answers', () => {
  for (const col of [9,10]) {
    const {context,guests,payload}=setup(); const input=payload(); guests.data[1][col]='changed';
    assert.throws(()=>context.submitMeals_(input),/changed since/); assert.equal(guests.writes,0);
  }
});
test('reject duplicate guests, missing guests, incorrect household or invalid token', () => {
  for (const mutate of [p=>p.guests[1].guestKey=p.guests[0].guestKey,p=>p.guests.pop(),p=>p.householdId='H2',p=>p.token='bad']) {
    const {context,guests,payload}=setup(); const input=payload(); mutate(input);
    assert.throws(()=>context.submitMeals_(input)); assert.equal(guests.writes,0);
  }
});
test('reception attendance is checked against the current sheet', () => {
  for (const [col,value] of [[6,'no'],[7,'haldi']]) {
    const {context,guests,payload}=setup(); const input=payload(); guests.data[1][col]=value;
    assert.throws(()=>context.submitMeals_(input),/guest list changed/); assert.equal(guests.writes,0);
  }
});
test('cached RSVP payload preserves allergies, existing meals, row order and organizer columns', () => {
  const {context,guests,current}=setup(); guests.data[1][10]='fish'; const input=current();
  input.forEach(g=>{delete g.allergies;delete g.mealChoice;delete g.guestKey;});
  input[0].firstName='Updated';
  context.saveGuests_(guests,'H1',input);
  assert.equal(guests.data[1][1],'Updated'); assert.equal(guests.data[1][9],'no pork'); assert.equal(guests.data[1][10],'fish'); assert.equal(guests.data[1][12],8);
  assert.equal(guests.data[3][0],'H2'); assert.equal(guests.data.length,5);
});
test('RSVP identities keep data with guests when names change or party is reordered', () => {
  const {context,guests,current}=setup(); const input=current().reverse(); input[2].firstName='New Name';
  context.saveGuests_(guests,'H1',input);
  assert.equal(guests.data[1][1],'New Name'); assert.equal(guests.data[1][9],'no pork'); assert.equal(guests.data[4][1],'Small');
});
test('dietary changes clear incompatible meals but preserve allergies', () => {
  const {context,guests,current}=setup(); guests.data[1][10]='fish'; const input=current(); delete input[0].mealChoice; input[0].dietary='vegan';
  context.saveGuests_(guests,'H1',input);
  assert.equal(guests.data[1][10],''); assert.equal(guests.data[1][9],'no pork');
});
test('missing invited guests fail before any row writes', () => {
  const {context,guests,current}=setup(); assert.throws(()=>context.saveGuests_(guests,'H1',current().slice(1)),/missing/); assert.equal(guests.writes,0);
});
test('confirmation escapes allergy notes and includes meal names', () => {
  const {context,current}=setup(); const input=current(); input[0].allergies='<script>alert(1)</script>'; input[0].mealChoice='fish';
  const result=context.buildConfirmationEmail_(input,'',''); assert.ok(result.textBody.includes('pine nut sauce')); assert.ok(result.htmlBody.includes('&lt;script&gt;')); assert.ok(!result.htmlBody.includes('<script>'));
});
