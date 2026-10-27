const assert=require('node:assert/strict');const c=require('./core');
const base={price:'100',cost:'40',commission:'10',tax:'5',shipping:'10',fixedFee:'5',adsAcos:'10',adsShare:'100',targetMargin:'20',adsMode:'acos',feeMode:'manual'};
let a=c.analyze(base);assert(a.ready);assert(Math.abs(a.org.profit-30)<1e-6);assert(Math.abs(a.ad.profit-20)<1e-6);assert.equal(a.breakEven,64.71);assert.equal(a.breakEvenAds,73.34);assert.equal(a.targetPrice,100);assert.equal(a.acosTarget,10);assert(Math.abs(a.safeAcos-7)<1e-6);
let loss=c.analyze({...base,price:'30'});assert(loss.org.profit<0);assert.equal(loss.verdict,'prejuizo');
let coupon=c.analyze({...base,discountPct:'10',discountFixed:'5'});assert(Math.abs(coupon.org.revenue-85)<1e-7);assert(Math.abs(coupon.org.profit-(85-40-10-5-8.5-4.25))<1e-6);
let cpc=c.analyze({...base,adsMode:'cpc',cpc:'0.60',conversion:'2'});assert(Math.abs(cpc.ad.adsCost-30)<1e-6);
let tiers={...base,feeMode:'bands',feeBands:'0:10;79:0',fixedFee:'0',adsAcos:'0',cost:'50'};assert.equal(c.feeFor(tiers,78.99),10);assert.equal(c.feeFor(tiers,79),0);assert.equal(c.solve(tiers,0,false),79); // breakpoint makes 79 competitive
assert.deepEqual(c.parseBands('abc'),[]); // invalid empty
let bad=c.analyze({...base,price:'',cost:''});assert(!bad.ready);let boundary=c.analyze({...base,commission:'0',tax:'0',shipping:'0',fixedFee:'0',adsAcos:'0',cost:'50',price:'50'});assert(boundary.ready);assert.equal(boundary.org.profit,0);
console.log('Core tests passed');

// Testes adicionais de fronteira e preço mínimo sob tarifas variadas.
for(let i=0;i<350;i++){
 const cost=(i*13)%350, shipping=(i*7)%42,comm=(i*5)%18,tax=(i*3)%16, f=(i*11)%19,acos=(i*9)%30;
 const p={...base,cost:String(cost),shipping:String(shipping),commission:String(comm),tax:String(tax),fixedFee:String(f),adsAcos:String(acos)};
 const target=(i%5)*5, breakPrice=c.solve(p,target,true);
 assert.notEqual(breakPrice,null);
 const result=c.calc(p,breakPrice,true);
 assert(result.profit+1e-7>=target/100*result.revenue,`Falhou i=${i}`);
 if(breakPrice>0.01){const before=c.calc(p,Math.round(breakPrice*100-1)/100,true);assert(before.profit-1e-7<target/100*before.revenue,`Preco anterior valido indevidamente i=${i}`);}
}
console.log('350 testes de fronteira passaram');

// ACOS interativo preserva o lucro líquido monetário do produto
let ideal=c.acosForProfit(base,'15');assert(ideal.ready);assert.equal(ideal.breakEvenAcos,30);assert.equal(ideal.idealAcos,15);assert.equal(ideal.allowedSpend,15);assert(Math.abs(ideal.roas-100/15)<1e-8);
let impossible=c.acosForProfit(base,'31');assert.equal(impossible.ready,false);
assert.equal(c.acosForProfit(base,'').ready,false);
let zeroLimit=c.acosForProfit(base,'30');assert(zeroLimit.ready);assert.equal(zeroLimit.idealAcos,0);
let negativeOrg=c.acosForProfit({...base,price:'30'},'0');assert.equal(negativeOrg.ready,false);
let mei=c.analyze({...base,taxRegime:'mei',dasMeiUnit:'0.82',tax:'0'});assert(mei.ready);assert(Math.abs(mei.org.profit-34.18)<1e-8);
const s1=c.simplesComercio(120000),s2=c.simplesComercio(200000);assert.equal(s1.rate,4);assert.equal(s2.nominal,7.3);assert(Math.abs(s2.rate-4.33)<1e-8);assert.equal(c.simplesComercio(0),null);
console.log('Testes adicionais de ACOS e imposto passaram');

// v1.2 blank numbers count as zero in the mathematical engine; price remains mandatory.
let blankCosts={price:'79.90',cost:'',commission:'',fixedFee:'',shipping:'',tax:'',inbound:'',packaging:'',feeMode:'manual',taxRegime:'pf',adsShare:'0'};
assert(c.analyze(blankCosts).ready);assert.equal(c.analyze(blankCosts).org.profit,79.90);
assert(!c.analyze({...blankCosts,price:''}).ready);
assert.equal(c.shippingCostSplit(60,20),3);
assert.equal(c.shippingCostSplit(60,0),null);
assert.equal(c.packagingSplit(30,10,10,0,50),1);
let flexP={...base,shippingMode:'flex',taxRegime:'pf',flexArea:'near',flexWeightGr:'400',flexLengthCm:'20',flexWidthCm:'12',flexHeightCm:'8',flexCourierCost:'12',flexCondition:'new',flexBonusMode:'estimated',flexReputation:'green'};
let ff=c.flexShipping(flexP,100);assert.equal(ff.tariff,7.99);assert.equal(ff.bonus,0.8);assert.equal(ff.net,11.2);
assert(Math.abs(c.calc(flexP,100).profit-(100-40-10-5-5-12+0.8))<1e-8);
assert.equal(c.flexShipping({...flexP,flexWidthCm:''}).bonus,0);
let low=c.flexShipping({...flexP,flexBonusMode:'estimated',flexReputation:'none'},70);assert.equal(low.bonus,7.99);
assert.equal(c.flexShipping({...flexP,flexWeightGr:'400',flexLengthCm:'70',flexWidthCm:'50',flexHeightCm:'20'},100).band,2);
console.log('Testes de campos vazios e Flex passaram');

// v1.3 — valores mostrados no print de bônus Flex para faixa 0,5–5 kg, SP.
const baseFlex={...base,shippingMode:'flex',taxRegime:'pf',flexWeightGr:'1200',flexLengthCm:'20',flexWidthCm:'15',flexHeightCm:'10',flexVolFactor:'6000',flexCourierCost:'15',flexCondition:'new',flexBonusMode:'estimated',flexLowFree:'no',flexReputation:'none'};
for(const [area,full] of [['near',8.99],['medium',10.89],['far',10.99]]){
  const r=c.flexShipping({...baseFlex,flexArea:area},59.90);
  assert.equal(r.band,1);assert.equal(r.tariff,full);assert.equal(r.bonus,full);
  assert.equal(c.cents(r.net),c.cents(15-full));
  const high=c.flexShipping({...baseFlex,flexArea:area,flexReputation:'green'},100);
  assert.equal(high.tariff,full);assert.equal(high.bonus,c.cents(full*0.1));
  assert.equal(c.flexShipping({...baseFlex,flexArea:area,flexReputation:'none'},100).bonus,0);
}
assert.equal(c.flexShipping({...baseFlex,flexBonusMode:'manual',flexBonusOverride:'10.89'},100).bonus,10.89);
assert.equal(c.flexShipping({...baseFlex,flexBonusMode:'manual',flexBonusOverride:'10.89'},100).net,4.109999999999999);
let volumeTest=c.flexShipping({...baseFlex,flexWeightGr:'200',flexLengthCm:'50',flexWidthCm:'40',flexHeightCm:'20',flexVolFactor:'6000'},60);
assert.equal(volumeTest.band,2); // 40 mil cm3 / 6000 = 6,667 kg
console.log('Testes Flex v1.3 (bônus do painel) passaram');
