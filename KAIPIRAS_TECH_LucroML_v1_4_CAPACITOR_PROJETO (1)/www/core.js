/* KAIPIRA'S TECH · Motor de precificação. Valores em BRL, taxas percentuais como 0–100. */
(function(root, factory){
  const api=factory();
  if(typeof module === 'object' && module.exports) module.exports=api;
  root.LucroCore=api;
})(typeof window !== 'undefined'?window:globalThis,function(){
  'use strict';
  const k=['price','cost','inbound','packaging','extra','overhead','storage','shipping','fixedFee','commission','tax','payment','returns','discountPct','discountFixed','adsAcos','cpc','conversion','adsShare','targetMargin','adsBudget','adsDays','expectedAdsSales','capital','stock','dasMeiUnit','adsPreserveProfit','meiDasMonthly','meiMonthlyUnits','simplesRbt12','flexWeightGr','flexLengthCm','flexWidthCm','flexHeightCm','flexCourierCost','flexBonusOverride','flexVolFactor'];
  function n(v){if(v==null||v==='')return 0;if(typeof v==='number')return Number.isFinite(v)?v:0;const s=String(v).trim().replace(/\s|R\$/g,''); const x=s.includes(',')?Number(s.replace(/\./g,'').replace(',','.')):Number(s);return Number.isFinite(x)?x:0;}
  function cents(v){return Math.round((v + Number.EPSILON)*100)/100;}
  function validate(p){let errors=[],warnings=[];
    ['cost','commission','tax','shipping','fixedFee','inbound','packaging'].filter(f=>(f!=='fixedFee'||p.feeMode!=='bands')&&(f!=='shipping'||p.shippingMode!=='flex')).forEach(f=>{ if(p[f]===undefined||String(p[f]).trim()==='')warnings.push(({cost:'Custo de compra',commission:'Comissão do Mercado Livre',tax:'Imposto',shipping:'Frete pago pelo vendedor',fixedFee:'Tarifa fixa',inbound:'Frete de compra rateado',packaging:'Embalagem por venda'}[f])+' considerado zero (não confirmado).'); });
    for(const key of k){const raw=p[key];if(raw!==''&&raw!==undefined&&raw!==null&&(!Number.isFinite(Number(String(raw).replace(',','.'))) || n(raw)<0))errors.push('Valor inválido em '+key);}
    for(const key of ['commission','tax','payment','returns','discountPct','adsAcos','adsShare','targetMargin','conversion'])if(n(p[key])>100)errors.push('Porcentagem maior que 100%: '+key);
    if(n(p.discountPct)>=100||n(p.discountFixed)>=n(p.price) && n(p.price)>0) errors.push('Desconto elimina toda a receita.');
    if(n(p.price)<0||n(p.cost)<0)errors.push('Preço e custo não podem ser negativos.');
    if(p.shippingMode==='flex'){
      if(n(p.flexVolFactor)!==0&&(n(p.flexVolFactor)<1000||n(p.flexVolFactor)>10000))errors.push('Fator de cubagem deve estar entre 1.000 e 10.000.');
      const required=['flexWeightGr','flexLengthCm','flexWidthCm','flexHeightCm','flexCourierCost'];
      for(const f of required)if(String(p[f]??'').trim()===''|| (f!=='flexCourierCost' && n(p[f])<=0))warnings.push('Flex: peso, medidas ou custo do entregador incompletos — custo em zero se vazio; tarifa e bônus podem estar subestimados.');
      if(p.flexBonusMode==='manual' && String(p.flexBonusOverride??'').trim()==='')warnings.push('Flex: bônus manual não informado; será considerado zero.');
      if(p.flexBonusMode!=='manual'&&(p.flexCondition==='used'||p.listingType==='free'))warnings.push('Flex: para usado/anúncio grátis confirme o bônus no painel; nesta simulação será zero sem confirmação.');
      if(n(p.flexCourierCost)===0 && String(p.flexCourierCost??'').trim()==='0') warnings.push('O custo do entregador Flex está em zero. Confirme que sua logística não tem custo.');
    }
    if(p.taxRegime==='pf'&&p.pfTaxMode!=='manual')warnings.push('CPF: percentual informado é uma reserva de planejamento, não apuração fiscal; confira o enquadramento e tributos reais.');
    if(p.taxRegime==='pf'&&p.pfTaxMode==='manual'&&n(p.tax)===0)warnings.push('CPF: alíquota informada como 0%; confirme o tratamento fiscal com profissional habilitado.');
    if(p.taxRegime==='mei'&&n(p.dasMeiUnit)===0)warnings.push('MEI: sem DAS mensal rateado. Informe o custo por unidade para uma margem mais fiel.');
    if(p.taxRegime!=='mei'&&n(p.dasMeiUnit)>0)warnings.push('O campo DAS-MEI está preenchido apesar do regime não ser MEI.');
    if(p.feeMode==='bands'&&!parseBands(p.feeBands).length)errors.push('Informe faixas válidas para tarifa fixa. Ex.: 0:5;79:0.');
    const adsReady=p.adsMode==='cpc' ? (String(p.cpc??'').trim()!=='' && n(p.conversion)>0) : String(p.adsAcos??'').trim()!=='';
    if(n(p.adsShare)>0 && !adsReady)errors.push('Informe ACOS ou CPC com conversão antes de simular vendas patrocinadas.');
    if(n(p.price)>0 && n(p.cost)===0 && String(p.cost).trim()==='0')warnings.push('Custo de compra igual a zero: confirme se é correto.');
    if(n(p.commission)+n(p.tax)+n(p.payment)+n(p.returns)+n(p.discountPct)>=100)warnings.push('As taxas e descontos podem inviabilizar a margem.');
    return {errors,warnings,adsReady,ready:errors.length===0&&n(p.price)>0};
  }
  function parseBands(str){ if(!str||typeof str!=='string')return []; const t=[]; const vals=str.split(/[;\n]/).map(x=>x.trim()).filter(Boolean);for(const s of vals){const m=s.match(/^(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)$/);if(!m)return [];t.push({min:n(m[1]),fee:n(m[2])});}t.sort((a,b)=>a.min-b.min);if(t.length && t[0].min!==0)return [];for(let i=1;i<t.length;i++)if(t[i].min<=t[i-1].min)return [];return t;}
  function feeFor(p,price){if(p.feeMode==='bands'){const bs=parseBands(p.feeBands);if(bs.length){let f=bs[0].fee;for(const b of bs){if(price+1e-9>=b.min)f=b.fee;else break;}return f;}}return n(p.fixedFee);}
  // Referência geográfica: tabela publicada para São Paulo pelo Mercado Livre (outubro/2026).
  // Peso faturável usa maior entre físico (kg) e volumétrico (cm³ / 5000).
  const FLEX_RATES_SP={near:[7.99,8.99,11.99],medium:[9.89,10.89,14.89],far:[9.99,10.99,14.99]};
  function flexShipping(p,price=n(p.price)){
    const physical=n(p.flexWeightGr)/1000;
    const vol=n(p.flexLengthCm)*n(p.flexWidthCm)*n(p.flexHeightCm)/(n(p.flexVolFactor)||6000);
    const chargeable=Math.max(physical,vol),measureReady=physical>0&&n(p.flexLengthCm)>0&&n(p.flexWidthCm)>0&&n(p.flexHeightCm)>0,band=chargeable<=0.5?0:chargeable<=5?1:2;
    const area=Object.hasOwn(FLEX_RATES_SP,p.flexArea)?p.flexArea:'near';
    const tariff=measureReady?FLEX_RATES_SP[area][band]:null;
    const courier=n(p.flexCourierCost);
    let bonus=0,rule='';
    if(p.flexBonusMode==='manual') {bonus=n(p.flexBonusOverride);rule='Bônus informado pelo vendedor';}
    else if(!measureReady){bonus=0;rule='Sem peso e dimensões completos: bônus não estimado';}
    else if(p.flexCondition==='used'||p.listingType==='free'){bonus=0;rule='Bônus de usados/anúncio grátis: informe valor confirmado';}
    else if(n(price)<19){bonus=p.flexLowFree==='yes'?0:tariff;rule=p.flexLowFree==='yes'?'Frete grátis voluntário abaixo de R$ 19: sem bônus':'Preço abaixo de R$ 19: bônus da tarifa';}
    else if(n(price)<79){bonus=tariff;rule='Preço de R$ 19 a R$ 78,99: bônus integral da tarifa';}
    else if(p.flexReputation==='green'){bonus=cents(tariff*.1);rule='Preço a partir de R$ 79, reputação verde: 10%';}
    else {bonus=0;rule='Preço a partir de R$ 79 sem reputação verde: não pressupomos bônus';}
    return {physical,vol,chargeable,measureReady,band,area,tariff,bonus,courier,net:courier-bonus,rule};
  }
  function calc(p,price=n(p.price),ads=false){
    const gross=price,discPct=n(p.discountPct),discFixed=n(p.discountFixed);
    const discount=price*discPct/100+discFixed, revenue=Math.max(0,price-discount);
    const flex=p.shippingMode==='flex'?flexShipping(p,price):null;
    const unitCosts={produto:n(p.cost),freteEntrada:n(p.inbound),embalagem:n(p.packaging),outros:n(p.extra),rateioFixo:n(p.overhead),armazenagem:n(p.storage),freteVenda:flex?flex.courier:n(p.shipping),dasMei:p.taxRegime==='mei'?n(p.dasMeiUnit):0};
    const commission=revenue*n(p.commission)/100, tax=revenue*n(p.tax)/100,
      payment=revenue*n(p.payment)/100, returns=revenue*n(p.returns)/100, fixedFee=feeFor(p,price);
    let adsCost=0;
    if(ads){if(p.adsMode==='cpc'){
        const cv=n(p.conversion),cpc=n(p.cpc);
        adsCost=cv>0?cpc/(cv/100):0;
      }else adsCost=revenue*n(p.adsAcos)/100;
    }
    const sumCosts=Object.values(unitCosts).reduce((a,b)=>a+b,0), bonus=flex?flex.bonus:0,expenses=sumCosts+commission+tax+payment+returns+fixedFee+adsCost-bonus;
    const profit=revenue-expenses;
    return {gross,discount,revenue,unitCosts,sumCosts,flex,bonus,commission,tax,payment,returns,fixedFee,adsCost,expenses,profit,margin:revenue>0?profit/revenue*100:null,roi:expenses>0?profit/expenses*100:null};
  }
  function solve(p,targetMargin=0,ads=false){
    targetMargin=n(targetMargin);
    if(targetMargin>=100 || targetMargin<0)return null;
    const bands=p.feeMode==='bands'?parseBands(p.feeBands):[];
    const borders=[0,...bands.map(b=>b.min).filter(x=>x>0),...(p.shippingMode==='flex'&&p.flexBonusMode!=='manual'?[19,79]:[]),1e7];
    const uniq=[...new Set(borders)].sort((a,b)=>a-b);
    function good(price){let r=calc(p,price,ads);return r.revenue>0 && r.profit+1e-8>=r.revenue*targetMargin/100;}
    for(let i=0;i<uniq.length-1;i++){
      const lower=uniq[i], upper=uniq[i+1];
      const lowCent=Math.ceil(lower*100-1e-7), highCent=Math.ceil(upper*100-1e-7)-1;
      if(lowCent>highCent)continue;
      if(good(lowCent/100))return lowCent/100;
      if(!good(highCent/100))continue;
      let lo=lowCent,hi=highCent;
      while(lo<hi){const mid=Math.floor((lo+hi)/2);if(good(mid/100))hi=mid;else lo=mid+1;}
      if(good(lo/100))return lo/100;
    }
    return null;
  }
  function analyze(p){const v=validate(p);if(!v.ready)return {validation:v, ready:false};
    const price=n(p.price),org=calc(p,price,false),ad=calc(p,price,true);
    const adsShare=n(p.adsShare)/100;
    const blendProfit=org.profit*(1-adsShare)+ad.profit*adsShare;
    const blendMargin=org.revenue>0?blendProfit/org.revenue*100:null;
    const maxAcos=org.revenue>0?org.profit/org.revenue*100:null;
    const targetProfit=org.revenue*n(p.targetMargin)/100;
    const acosTarget=org.revenue>0?(org.profit-targetProfit)/org.revenue*100:null;
    const maxAdUnit=Math.max(0,org.profit-targetProfit),budget=n(p.adsBudget),days=n(p.adsDays)||30,expected=n(p.expectedAdsSales);
    const spendUnit=ad.adsCost, monthlyProjected=expected*spendUnit,
      availableBudget=budget>0?budget/days:null;
    const cpcCeiling=n(p.conversion)>0?maxAdUnit*n(p.conversion)/100:null;
    const inventoryCost=n(p.stock)*(n(p.cost)+n(p.inbound));
    let verdict=blendProfit<0?'prejuizo':blendProfit<0.01?'equilibrio':blendMargin<n(p.targetMargin)?'atencao':'lucro';
    return {ready:true,validation:v,adsReady:v.adsReady,price,org,ad,blendProfit,blendMargin, maxAcos,acosTarget,safeAcos:Math.max(0,(acosTarget||0)*0.7), maxAdUnit,cpcCeiling,monthlyProjected,availableBudget,inventoryCost,
      breakEven:solve(p,0,false),breakEvenAds:solve(p,0,true),targetPrice:solve(p,n(p.targetMargin),true),targetOrganic:solve(p,n(p.targetMargin),false),verdict};
  }

  // ACOS: custo / receita atribuída. A meta de lucro é absoluta por unidade.
  function acosForProfit(p, desiredProfit){
    const v=validate(p);
    if(!v.ready || desiredProfit===null || desiredProfit===undefined || String(desiredProfit).trim()==='')return {ready:false,reason:'Preencha os custos essenciais e o lucro desejado.'};
    const desired=n(desiredProfit), r=calc(p,n(p.price),false);
    if(desired<0 || !Number.isFinite(desired) || r.revenue<=0)return {ready:false,reason:'Valores inválidos para calcular o ACOS.'};
    if(r.profit<=0)return {ready:false,reason:'Produto sem lucro antes de Ads. Corrija o preço ou os custos.'};
    if(desired>r.profit+1e-8)return {ready:false,reason:'A meta de lucro é maior que o lucro sem Ads disponível. Reduza a meta ou aumente o preço.'};
    const adSpend=Math.max(0,r.profit-desired),ideal=adSpend/r.revenue*100;
    const breakEven=r.profit/r.revenue*100;
    return {ready:true,revenue:r.revenue,organicProfit:r.profit,desiredProfit:desired,idealAcos:ideal,breakEvenAcos:breakEven,allowedSpend:adSpend,roas:ideal>0?100/ideal:null};
  }
  // Para comércio em condições comuns de tributação no Anexo I do Simples.
  function simplesComercio(rbt12){
    const raw=String(rbt12??'').trim();if(!raw)return null;
    const v=n(raw);if(!Number.isFinite(v)||v<=0||v>4800000)return null;
    const bands=[[180000,4,0],[360000,7.3,5940],[720000,9.5,13860],[1800000,10.7,22500],[3600000,14.3,87300],[4800000,19,378000]];
    const band=bands.find(([ceil])=>v<=ceil);const effective=(v*band[1]/100-band[2])/v*100;
    return {rate:effective,nominal:band[1],deduction:band[2],rbt12:v};
  }
  function shippingCostSplit(total,units){const u=n(units),t=n(total);return u>0&&Number.isInteger(u)&&t>=0?cents(t/u):null;}
  function packagingSplit(box,tape,protection,other,units){const u=n(units);return u>0&&Number.isInteger(u)?cents((n(box)+n(tape)+n(protection)+n(other))/u):null;}
  return {shippingCostSplit,packagingSplit,n,cents,calc,solve,analyze,validate,parseBands,feeFor,acosForProfit,simplesComercio,flexShipping,FLEX_RATES_SP};
});
