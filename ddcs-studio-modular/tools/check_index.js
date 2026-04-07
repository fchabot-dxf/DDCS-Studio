(async ()=>{
  try{
    const r = await fetch('http://127.0.0.1:3000/');
    const txt = await r.text();
    console.log('contains import(\'./app.js\')? ->', txt.indexOf("import('./app.js')")>-1);
    // print the module script block for inspection
    const m = txt.match(/<script[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/i);
    if (m) console.log('module script snippet:\n', m[0].slice(0,400));
  }catch(e){console.error(e)}
})();
