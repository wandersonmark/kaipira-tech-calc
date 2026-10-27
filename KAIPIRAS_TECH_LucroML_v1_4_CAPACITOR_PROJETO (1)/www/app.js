(function(){'use strict';
const C=window.LucroCore, $=id=>document.getElementById(id), $$=(q)=>[...document.querySelectorAll(q)];
const money=x=>x===null||!Number.isFinite(x)?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(C.cents(x));
const percent=x=>x===null||!Number.isFinite(x)?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:1}).format(x)+'%';
const safeid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const FIELDS=$$('input[data-field],select[data-field]');let store={},savedProducts=[],settings={},currentId=null,lastOcrPrice=null,toastTimer,hasCalculated=false,zeroAssumptions=[];
const defaultDraft=()=>({listingType:'classic',feeMode:'manual',adsMode:'acos',adsShare:'0',adsDays:'30',targetMargin:settings.targetDefault||'20',taxRegime:'pf',tax:'10',pfTaxMode:'provisional10',shippingMode:'normal',flexBonusMode:'estimated',flexArea:'near',flexCondition:'new',flexReputation:'none',flexLowFree:'no',flexVolFactor:'6000',meiDasMonthly:'82.05'});
function readStorage(key,def){try{const s=localStorage.getItem(key);return s===null?def:JSON.parse(s);}catch(_){return def;}}
function writeStorage(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true;}catch(_){notify('Armazenamento indisponível. Exporte um backup.',true);return false;}}
function notify(msg,bad=false){const el=$('toast');el.textContent=msg;el.style.background=bad?'#7c3539':'#1d2c37';el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3700);}
function form(){const p={};for(const el of FIELDS)p[el.dataset.field]=el.value;return p;}
function fill(p){hasCalculated=false;zeroAssumptions=[];for(const el of FIELDS)el.value=p[el.dataset.field]??'';viewDynamic();render();}
function viewDynamic(){const p=form();$('bandField').hidden=p.feeMode!=='bands';$('acosField').hidden=p.adsMode==='cpc';$('cpcField').hidden=p.adsMode!=='cpc';$('conversionField').hidden=p.adsMode!=='cpc';$('taxMeiHelp').hidden=p.taxRegime!=='mei';$('taxSimplesHelp').hidden=p.taxRegime!=='simples';$('taxOtherHelp').hidden=p.taxRegime!=='other';$('taxPfHelp').hidden=p.taxRegime!=='pf';$('flexField').hidden=p.shippingMode!=='flex';$('shippingManualField').hidden=p.shippingMode==='flex';$('flexBonusManualField').hidden=p.flexBonusMode!=='manual';}
function text(id,value){$(id).textContent=value;}
function getTaxProposal(p){
  if(p.taxRegime==='mei'){
    const das=String(p.meiDasMonthly??'').trim(),qty=String(p.meiMonthlyUnits??'').trim();
    if(!das||!qty||C.n(das)<=0||C.n(qty)<=0||!Number.isInteger(C.n(qty)))return {ready:false,note:'Informe o DAS mensal pago e uma estimativa de unidades vendidas no mês.'};
    return {ready:true,mode:'mei',tax:'0',dasMeiUnit:String(Math.ceil(C.n(das)/C.n(qty)*100-1e-9)/100),note:`DAS mensal ${money(C.n(das))} ÷ ${C.n(qty)} unidades = ${money(Math.ceil(C.n(das)/C.n(qty)*100-1e-9)/100)} por unidade (arredondado para cima).`};
  }
  if(p.taxRegime==='simples'){
    const s=C.simplesComercio(p.simplesRbt12);
    if(!s)return {ready:false,note:'Informe uma RBT12 positiva até R$ 4.800.000,00. Empresas em início de atividade precisam de regra especial.'};
    return {ready:true,mode:'simples',tax:String(Math.ceil(s.rate*10000)/10000),dasMeiUnit:'0',note:`Estimativa: alíquota efetiva ${percent(s.rate)} (nominal ${percent(s.nominal)} e dedução ${money(s.deduction)}). Confirme segregação, ICMS-ST e exceções com seu contador.`};
  }
  return {ready:false,note:p.taxRegime==='other'?'Peça ao contador a alíquota efetiva aplicável à venda e preencha manualmente o campo de imposto.':'Selecione MEI ou Simples Nacional para calcular uma referência.'};
}
function renderTax(p){
  const result=getTaxProposal(p);
  const cpf=p.taxRegime==='pf';
  const taxText=cpf ? (p.pfTaxMode==='provisional10'&&C.n(p.tax)===10
    ? 'Pessoa física (CPF): os 10% são uma RESERVA GERENCIAL PROVISÓRIA, não uma alíquota oficial ou um imposto apurado. Ela reduz seu lucro simulado. Confira sua situação tributária com um contador.'
    : 'Pessoa física (CPF): o percentual informado é uma estimativa de planejamento, não apuração oficial. Zero não significa isenção. Consulte um contador.') : result.note;
  text('taxEstimate',taxText);
  text('taxGuidance',cpf?'CPF: 10% de reserva provisória pré-preenchida (editável). Não é imposto oficialmente devido.':'Informe a alíquota do regime escolhido; a reserva de 10% é exclusiva da simulação inicial no CPF.');
  text('taxFieldLabel',cpf?'Reserva tributária provisória sobre venda':'Imposto efetivo sobre venda');
  $('applyTaxEstimate').disabled=!result.ready;
}
function renderIdealAcos(p,a){
  const r=hasCalculated?C.acosForProfit(p,p.adsPreserveProfit):{ready:false,reason:'Clique em CALCULAR MEU LUCRO antes de definir o ACOS ideal.'};
  text('idealBaseRevenue',a.ready?money(a.org.revenue):'—');text('idealBaseProfit',a.ready?money(a.org.profit):'—');
  text('idealBreakEven',a.ready&&a.org.profit>0?percent(a.maxAcos):'—');
  text('idealAcos',r.ready?percent(r.idealAcos):'—');text('idealSpend',r.ready?money(r.allowedSpend):'—');text('idealRoas',r.ready?(r.roas?r.roas.toFixed(2).replace('.',',')+'x':'Sem verba para Ads'):'—');
  text('idealAdvice',r.ready?`Para manter ${money(r.desiredProfit)} de lucro líquido, o gasto máximo atribuído a cada venda é ${money(r.allowedSpend)}. O ACOS máximo teórico é ${percent(r.idealAcos)}. Meta mais conservadora pode ser menor.`:r.reason);
  $('applyIdealAcos').disabled=!r.ready||r.idealAcos<=0;
}

function renderFlex(p){
  const r=C.flexShipping(p), el=$('flexEstimate'),table=$('flexBonusReference');
  if(p.shippingMode!=='flex'){el.textContent='Flex não selecionado.';return;}
  const formatter=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  // Valores do quadro compartilhado pelo vendedor coincidem com a faixa intermediária oficial de SP.
  const areas={near:'próxima',medium:'média distância',far:'distante'};
  const areaLabel=areas[r.area]||'próxima';
  const rows=table.querySelectorAll('tbody tr');
  rows.forEach((tr,i)=>{const selected=r.measureReady && i===r.band;tr.classList.toggle('selectedBand',selected);tr.setAttribute('aria-selected',String(selected));});
  const allCells=table.querySelectorAll('tbody td[data-area]');
  allCells.forEach(td=>td.classList.toggle('selectedArea',td.dataset.area===r.area && r.measureReady && td.closest('tr').classList.contains('selectedBand')));
  const wt=r.measureReady?`${r.chargeable.toFixed(3).replace('.',',')} kg (peso real ${r.physical.toFixed(3).replace('.',',')} kg; peso volumétrico ${r.vol.toFixed(3).replace('.',',')} kg)`:'peso/dimensões incompletos — faixa sem confirmação';
  const source=p.flexBonusMode==='manual'?'Valor de bônus informado manualmente; verifique que é aplicável a esta venda.':'Bônus ESTIMADO conforme preço, condição do produto e reputação; não é crédito confirmado.';
  let extra='';
  if(r.measureReady&&r.band===1)extra=`Na faixa do seu print (0,5 a 5 kg), a tarifa de referência para área ${areaLabel} é ${money(r.tariff)}. `;
  if(r.measureReady&&r.band!==1)extra='A faixa do seu pacote é DIFERENTE da faixa de 0,5 a 5 kg mostrada no print. ';
  if(p.flexBonusMode!=='manual'&&r.tariff!==null&&C.n(p.price)>=79)extra+='Em produtos novos a partir de R$ 79, o bônus integral NÃO é garantido; na regra publicada, o valor usual é 10% da tarifa com reputação verde. ';
  el.textContent=`Peso considerado: ${wt}. Tarifa-base de referência: ${r.tariff===null?'não identificada':money(r.tariff)}. Bônus para sua venda: ${money(r.bonus)}. Você paga ao entregador: ${money(r.courier)}. Custo líquido para você: ${money(r.net)}. ${extra}${r.rule}. ${source}`;
}
const HELP={
  commission:{title:'Comissão do anúncio',body:'Procure a porcentagem de comissão no simulador de custos do próprio anúncio (Clássico ou Premium, categoria e preço). Exemplo: venda de R$ 100 com 12% de comissão = R$ 12. Nunca adivinhe a porcentagem.',calc:'percent'},
  fixedFee:{title:'Tarifa fixa por venda',body:'É uma cobrança fixa adicional por unidade vendida, se houver. O valor depende de preço, modalidade logística e outras condições. Consulte o simulador oficial; se não for cobrada, use zero. Não confunda com comissão percentual.',calc:'none'},
  shipping:{title:'Frete pago por você',body:'É a despesa que efetivamente reduz o seu lucro para enviar a mercadoria ao CLIENTE. Se o Mercado Livre desconta R$ 9,50 da sua venda, preencha R$ 9,50. Não some uma segunda vez valores já descontados. Para Envios Flex, selecione a modalidade Flex e informe o entregador e o bônus separadamente.',calc:'freight'},
  inbound:{title:'Frete de compra rateado',body:'É o transporte de ENTRADA: o que você pagou para o fornecedor mandar o estoque até você. Não é a entrega ao cliente. Exemplo: comprou 20 produtos e pagou R$ 60 de frete do fornecedor; cada produto carrega R$ 3 de custo de compra adicional. Se o frete já estiver incluído no preço de custo informado, NÃO o repita aqui.',calc:'divide'},
  packaging:{title:'Embalagem por venda',body:'Some o custo de caixa/envelope + fita adesiva + proteção (plástico-bolha, sacos) + etiqueta consumidos na embalagem de UMA venda. Não inclua o valor de compra de uma bobina inteira, apenas a parte utilizada. Se comprar materiais em lote, divida o custo total pelos pacotes atendidos.',calc:'package'},
  tax:{title:'Imposto ou reserva tributária sobre a venda',body:'No CPF, o aplicativo preenche 10% como RESERVA PROVISÓRIA para simular um custo e proteger sua margem. Não é uma alíquota oficial nem garante cobertura das obrigações fiscais; consulte um contador. Esse campo pode ser editado. No MEI, o DAS costuma entrar como custo mensal rateado, e no Simples a alíquota efetiva depende do faturamento. Evite duplicar impostos.',calc:'percent'},
  dasMeiUnit:{title:'DAS-MEI por unidade',body:'Somente quando estiver vendendo como MEI. Divida o DAS pago no mês pela previsão de unidades que venderá naquele mês. Exemplo: R$ 82,05 ÷ 100 produtos = aproximadamente R$ 0,82 por produto. No CPF, o campo não entra no cálculo.',calc:'divide'},
  price:{title:'Preço anunciado',body:'Preço efetivo do anúncio ANTES do desconto que você paga. É o único campo obrigatório para calcular. Evite colocar o preço do concorrente como se fosse seu preço.',calc:'none'},
  cost:{title:'Preço de custo',body:'Quanto você paga para adquirir UMA unidade que vai vender. Se compra caixa com 12 produtos por R$ 240, o custo é R$ 20 por unidade. Some outros custos de entrada apenas nos campos específicos para não duplicar.',calc:'divide'},
  adsAcos:{title:'ACOS previsto (%)',body:'ACOS é o custo dos anúncios dividido pela receita atribuída aos Ads. Ex.: investiu R$ 30 e vendeu R$ 300 via Ads: ACOS = 10%. A calculadora de ACOS ideal abaixo informa o limite pela margem.',calc:'acos'},
  adsShare:{title:'Vendas atribuídas aos Ads (%)',body:'É a parcela esperada de vendas originadas do anúncio patrocinado. Use 100% para analisar o lucro de uma venda patrocinada. Use 0% para venda orgânica. Não é a comissão de publicidade.',calc:'percent'},
  flexCourierCost:{title:'Custo do entregador Flex',body:'Quanto o motoboy ou operador logístico cobra de você para a entrega Flex. É um custo real de operação, e NÃO a tarifa que o Mercado Livre mostra ao comprador. O bônus do ML é uma entrada separada.',calc:'freight'},
  flexWeightGr:{title:'Peso embalado (Flex)',body:'Pese o pacote já fechado, com a embalagem, em gramas. O Flex compara o peso físico com o peso volumétrico (comprimento × largura × altura ÷ fator de cubagem; padrão simulado 6.000), usando o maior.',calc:'none'},
  flexArea:{title:'Área de entrega (Flex)',body:'O Mercado Livre classifica em região próxima, média e distante. Confira a zona real na configuração de cobertura do seu Envios Flex. A tabela de São Paulo tem tarifas distintas por faixa de peso e zona.',calc:'none'},
  flexVolFactor:{title:'Fator do peso volumétrico',body:'O peso de cubagem é comprimento × largura × altura (cm) dividido pelo fator. O aplicativo sugere 6.000, mas este é um parâmetro de simulação: confira no painel do seu envio e altere se necessário. Exemplo: 60 × 40 × 30 ÷ 6.000 = 12 kg.',calc:'none'},
  flexBonusOverride:{title:'Bônus real do Flex',body:'Quanto o Mercado Livre efetivamente credita a você para compensar o entregador. Se o painel mostrar R$ 1,20, informe R$ 1,20. O bônus é receita de frete, não desconto automático do custo total.',calc:'none'},
  feeBands:{title:'Tarifas fixas por faixa',body:'Use somente se conhece a tabela oficial específica da sua categoria e modo logístico. Exemplo ilustrativo de formato: 0:5;79:0. É perigoso presumir que a tarifa fica zerada em uma faixa sem conferir na conta.',calc:'none'},
  adsPreserveProfit:{title:'Lucro mínimo desejado após Ads',body:'Informe quanto pretende ganhar em reais por unidade DEPOIS da publicidade. O aplicativo calcula o máximo de gasto em anúncio permitido para preservar essa meta. Quanto mais alto o lucro desejado, menor o ACOS máximo.',calc:'none'},
  overhead:{title:'Custo fixo rateado',body:'É a parcela por venda de aluguel, internet, sistema, mensalidades e outras despesas fixas. Divida o gasto mensal pela quantidade estimada de vendas. Não repita o DAS do MEI se já informado separadamente.',calc:'divide'},
  returns:{title:'Reserva para devoluções',body:'Uma porcentagem prudencial do faturamento para absorver perdas com devoluções, avarias ou reclamações. Não significa que toda devolução tem custo integral. Use dados do seu histórico quando disponíveis.',calc:'percent'},
};
const MAIN_ZERO=['cost','commission','fixedFee','shipping','tax','inbound','packaging','dasMeiUnit'];
const FLEX_ZERO=['flexWeightGr','flexLengthCm','flexWidthCm','flexHeightCm','flexCourierCost'];
function labelFor(el){return el?.closest('.field')?.querySelector('label')?.textContent?.replace(/[?*]/g,'').trim()||el?.id||'Campo';}
function absentFields(){const p=form(),ids=MAIN_ZERO.filter(x=>!(p.shippingMode==='flex'&&x==='shipping')&&!(p.feeMode==='bands'&&x==='fixedFee')&&!(p.taxRegime!=='mei'&&x==='dasMeiUnit'));
 if(p.shippingMode==='flex'){ids.push(...FLEX_ZERO);if(p.flexBonusMode==='manual')ids.push('flexBonusOverride');}
 if(C.n(p.adsShare)>0)ids.push(p.adsMode==='cpc'?'cpc':'adsAcos');
 return ids.filter(id=>String($(id)?.value??'').trim()==='');}
function applyZeroDefaults(){for(const el of $$('input[data-field][type="number"]')){if(el.id==='price')continue;if(el.value.trim()==='')el.value='0';}}
function confirmAndCalculate(){const p=form(),v=C.validate(p);
 if(!String(p.price??'').trim()||C.n(p.price)<=0){notify('Informe um preço de venda maior que zero antes de calcular.',true);$('price').focus();return;}
 if(v.errors.length){notify('Corrija antes de calcular: '+v.errors[0],true);return;}
 const missing=absentFields();if(missing.length){const list=$('zeroList');list.replaceChildren(...missing.map(id=>{const li=document.createElement('li');li.textContent=labelFor($(id));return li;}));$('zeroDialog').showModal();return;}
 commitCalculation();}
function commitCalculation(){zeroAssumptions=absentFields().map(id=>labelFor($(id)));applyZeroDefaults();if($('zeroDialog').open)$('zeroDialog').close();hasCalculated=true;render();autosave();$('calculationInstruction').textContent='Resultado calculado. Se alterar algum campo, clique em Calcular novamente para atualizar.';notify('Lucro calculado. Confira as advertências do resultado.');}
function showHelp(id){const h=HELP[id];if(!h)return; text('helpTitle',h.title);$('helpExplanation').textContent=h.body;
 const el=$('helpCalcArea');el.replaceChildren();const formel=document.createElement('div');formel.className='miniCalc';
 const add=(name,placeholder,value='')=>{const box=document.createElement('label');box.textContent=name;const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.placeholder=placeholder;input.value=value;box.append(input);formel.append(box);return input;};
 let a,b,c,d,e;
 if(h.calc==='divide'){a=add('Total pago (R$)','Ex.: 60');b=add('Quantidade de unidades','Ex.: 20');}
 else if(h.calc==='package'){a=add('Caixas/envelopes (R$ total)','Ex.: 30');b=add('Fitas/etiquetas (R$ total)','Ex.: 10');c=add('Proteção/outros (R$ total)','Ex.: 10');d=add('Número de pacotes montados','Ex.: 50');}
 else if(h.calc==='percent'){a=add('Valor da venda (R$)','Ex.: 100',String($('price').value||''));b=add('Porcentagem (%)','Ex.: 12');}
 else if(h.calc==='acos'){a=add('Gasto nos anúncios (R$)','Ex.: 30');b=add('Vendas atribuídas aos Ads (R$)','Ex.: 300');}
 else if(h.calc==='freight'){a=add('Custo pago (R$)','Ex.: 12');b=add('Crédito/subsídio confirmado (R$)','Ex.: 3');}
 if(a){const result=document.createElement('div');result.className='helperResult';result.textContent='Informe os valores para ver a simulação.';formel.append(result);
 const update=()=>{let v=null;
 if(h.calc==='divide')v=a.value.trim()&&b.value.trim()?C.shippingCostSplit(a.value,b.value):null;
 if(h.calc==='package')v=a.value.trim()&&b.value.trim()&&c.value.trim()&&d.value.trim()?C.packagingSplit(a.value,b.value,c.value,'0',d.value):null;
 if(h.calc==='percent')v=a.value.trim()&&b.value.trim()?C.n(a.value)*C.n(b.value)/100:null;
 if(h.calc==='acos')v=a.value.trim()&&C.n(b.value)>0?C.n(a.value)/C.n(b.value)*100:null;
 if(h.calc==='freight')v=a.value.trim()&&b.value.trim()?C.n(a.value)-C.n(b.value):null;
 result.textContent=v===null?'Preencha todos os valores necessários.':(h.calc==='acos'?percent(v):money(v));apply.disabled=v===null||v<0||!Number.isFinite(v);};
 const apply=document.createElement('button');apply.className='btnOutline';apply.type='button';apply.textContent='Usar este resultado no campo';apply.disabled=true;formel.append(apply);
 for(const i of [a,b,c,d,e].filter(Boolean))i.addEventListener('input',update);
 apply.onclick=()=>{let value;if(h.calc==='divide')value=C.shippingCostSplit(a.value,b.value);else if(h.calc==='package')value=C.packagingSplit(a.value,b.value,c.value,'0',d.value);else if(h.calc==='percent')value=C.n(b.value);else if(h.calc==='acos')value=C.n(a.value)/C.n(b.value)*100;else value=C.n(a.value)-C.n(b.value);
 if(value===null||!Number.isFinite(value)||value<0)return;$(id).value=String(Math.round(value*100)/100);if(id==='tax' && $('taxRegime').value==='pf')$('pfTaxMode').value='manual';hasCalculated=false;render();autosave();$('helpDialog').close();notify('Valor da simulação aplicado. Clique em Calcular meu lucro.');};
 el.append(formel);}
 $('helpDialog').showModal();}
function initFieldHelp(){for(const [id,h] of Object.entries(HELP)){const input=$(id),label=input?.closest('.field')?.querySelector('label');if(!label)continue;const b=document.createElement('button');b.type='button';b.className='fieldHelp';b.textContent='?';b.title='Como preencher '+h.title;b.setAttribute('aria-label','Ajuda: '+h.title);b.onclick=()=>showHelp(id);label.append(b);}}

function render(){const p=form();store=p;const a=C.analyze(p);viewDynamic();renderTax(p);renderIdealAcos(p,hasCalculated?a:{ready:false});renderFlex(p);
if(!hasCalculated||!a.ready){text('status',!hasCalculated?'CLIQUE EM CALCULAR':a.validation.errors.length?'CORRIJA OS DADOS':'DADOS INCOMPLETOS');$('status').className='status pending';text('bigProfit','—');$('bigProfit').className='bigprofit';text('bigCaption',!hasCalculated?'Preencha o preço e os custos que souber; depois clique no botão CALCULAR MEU LUCRO.':'Corrija os dados inválidos e clique em calcular novamente.');for(const id of ['marginMetric','organicMetric','adMetric','revMetric','breakEven','breakEvenAds','targetPrice','maxAcos','targetAcos','safeAcos','minRoas'])text(id,'—');text('warnings',hasCalculated?[...a.validation.errors,...a.validation.warnings].join(' • '):'Nenhum resultado será considerado definitivo antes de você clicar em calcular e revisar os custos em branco.');text('adsNote','Resultados de Ads disponíveis quando os custos essenciais estiverem completos.');$('auditRows').replaceChildren();$('bars').replaceChildren();text('budgetAnalysis','Preencha o produto e a verba para analisar o orçamento.');return;}
$('status').textContent={prejuizo:'PREJUÍZO',equilibrio:'EMPATE',atencao:'ABAIXO DA META',lucro:'META ATINGIDA'}[a.verdict];$('status').className='status '+a.verdict;
text('bigProfit',money(a.blendProfit));$('bigProfit').className='bigprofit '+(a.blendProfit<0?'negative':'positive');text('bigCaption',`Receita líquida menos todos os custos informados. Combinação: ${percent(C.n(p.adsShare))} de vendas patrocinadas.`);text('marginMetric',percent(a.blendMargin));text('organicMetric',money(a.org.profit));text('adMetric',a.adsReady?money(a.ad.profit):'Configurar Ads');text('revMetric',money(a.org.revenue));
text('breakEven',money(a.breakEven));text('breakEvenAds',a.adsReady?money(a.breakEvenAds):'—');text('targetPrice',a.adsReady?money(a.targetPrice):'—');
let warns=[...a.validation.warnings];if(C.n(p.dasMeiUnit)>0&&C.n(p.tax)>0)warns.push('Há imposto percentual e DAS-MEI rateado ao mesmo tempo. Confira se não existe duplicidade.');if(p.feeMode==='manual'&&a.breakEven!==null&&((a.price<79&&a.breakEven>=79)||(a.price>=79&&a.breakEven<79)))warns.push('O preço mínimo cruza R$79. A tarifa fixa pode mudar.');
if(p.adsMode==='cpc'&&C.n(p.adsShare)>0&&C.n(p.cpc)>0&&C.n(p.conversion)===0)warns.push('CPC sem conversão válida: projeção de Ads não confiável.');
if(zeroAssumptions.length)warns.unshift('CUSTOS ASSUMIDOS COMO ZERO: '+zeroAssumptions.join(', ')+'.');if(!a.adsReady)warns.push('Ads ainda não configurado: o lucro combinado considera apenas vendas orgânicas.');if(p.taxRegime==='pf')warns.push('CPF: percentual aplicado como RESERVA GERENCIAL, não como imposto fiscalmente apurado. O lucro é estimado; confirme as obrigações com contador.');
text('warnings',warns.length? 'ATENÇÃO · '+warns.join(' • '):'Simulação calculada com os valores inseridos por você. Tarifas, imposto e frete precisam de conferência na plataforma.');
const rows=[['Preço anunciado',a.org.gross],['(-) Desconto / cupom',-a.org.discount],['Receita recebida (base)',a.org.revenue],['(-) Compra do produto',-a.org.unitCosts.produto],['(-) Frete da compra',-a.org.unitCosts.freteEntrada],['(-) Embalagem',-a.org.unitCosts.embalagem],['(-) DAS-MEI rateado',-a.org.unitCosts.dasMei],['(-) Frete da venda / entregador Flex',-a.org.unitCosts.freteVenda],['(+) Bônus Flex creditado',a.org.bonus],['(-) Outras despesas, rateio e Full',-(a.org.unitCosts.outros+a.org.unitCosts.rateioFixo+a.org.unitCosts.armazenagem)],['(-) Comissão ML',-a.org.commission],['(-) Tarifa fixa ML',-a.org.fixedFee],[p.taxRegime==='pf'?'(-) Reserva tributária estimada (CPF)':'(-) Imposto',-a.org.tax],['(-) Outras taxas %',-a.org.payment],['(-) Reserva para devoluções',-a.org.returns],['(-) Ads, média por venda',-(a.ad.adsCost*C.n(p.adsShare)/100)],['(=) Lucro líquido combinado',a.blendProfit]];
$('auditRows').replaceChildren(...rows.map((r,i)=>{const el=document.createElement('div');el.className='auditrow'+(i===rows.length-1?' total':'');const s=document.createElement('span'),b=document.createElement('strong');s.textContent=r[0];b.textContent=money(r[1]);el.append(s,b);return el;}));
const total=Math.max(a.org.revenue,0.01), parts=[a.org.sumCosts,a.org.commission+a.org.fixedFee+a.org.tax+a.org.payment+a.org.returns,a.ad.adsCost*C.n(p.adsShare)/100,Math.max(0,a.blendProfit)];$('bars').replaceChildren(...parts.map(x=>{const d=document.createElement('div');d.style.width=Math.min(100,100*Math.max(x,0)/total)+'%';return d;}));
text('maxAcos',percent(a.maxAcos));text('targetAcos',percent(a.acosTarget));text('safeAcos',percent(a.safeAcos));text('minRoas',a.acosTarget>0?(100/a.acosTarget).toFixed(2).replace('.',',')+'x':'Não viável');
text('adsNote',a.acosTarget<=0?'A margem desejada não deixa sobra para publicidade neste preço. Corrija custos, preço ou meta antes de anunciar.':`Para preservar sua margem de ${percent(C.n(p.targetMargin))}, gaste até ${money(a.maxAdUnit)} por venda atribuída a Ads. O ACOS prudencial de ${percent(a.safeAcos)} utiliza 70% desse teto como reserva gerencial, não é garantia de performance.`);
const budget=C.n(p.adsBudget),days=C.n(p.adsDays)||30,sales=C.n(p.expectedAdsSales),stock=C.n(p.stock),capital=C.n(p.capital),remaining=capital-a.inventoryCost-budget;let lines=[];
if(budget>0){lines.push(`Verba de ${money(budget)} / ${days} dias = <strong>${money(budget/days)} por dia</strong>.`);if(sales>0){lines.push(`Verba disponível por venda atribuída projetada: <strong>${money(budget/sales)}</strong>. Teto pela margem: <strong>${money(a.maxAdUnit)}</strong> por venda.`);lines.push(budget/sales>a.maxAdUnit?'⚠ A verba por venda excede o teto necessário para a margem definida.':'A projeção de verba por venda está dentro do teto da sua margem.');}}
if(stock>0)lines.push(`Compra estimada de ${stock} un.: <strong>${money(a.inventoryCost)}</strong> (produto + frete de entrada).`);
if(capital>0)lines.push(`Capital disponível: ${money(capital)}. Após estoque e verba Ads: <strong>${money(remaining)}</strong>. ${remaining<0?'⚠ Caixa insuficiente para esse plano.':''}`);
if(p.adsMode==='cpc'&&C.n(p.conversion)>0)lines.push(`CPC máximo para preservar a meta: <strong>${money(a.cpcCeiling)}</strong> (com a conversão informada).`);
$('budgetAnalysis').innerHTML=lines.length?lines.join('<p></p>'):'Informe verba e/ou capital de giro; não é possível recomendar um gasto diário sem esses dados.';
}
function autosave(){writeStorage('ktml_draft_v1',{id:currentId,data:form()});}
function newProduct(){currentId=null;hasCalculated=false;fill(defaultDraft());$('photoArea').hidden=true;$('screenshot').value='';autosave();navigate('calculator');notify('Novo produto: reserva tributária provisória de 10% no CPF; demais custos em branco.');}
function saveProduct(){const p={...form(),_analysisConfirmed:hasCalculated},a=hasCalculated?C.analyze(p):{ready:false};if(!p.name.trim()){notify('Dê um nome ao produto para salvar.',true);$('name').focus();return;}
if(currentId){const i=savedProducts.findIndex(x=>x.id===currentId);if(i>=0)savedProducts[i]={...savedProducts[i],data:p,updated:new Date().toISOString()};else currentId=null;}
if(!currentId){currentId=safeid();savedProducts.unshift({id:currentId,data:p,created:new Date().toISOString(),updated:new Date().toISOString()});}
writeStorage('ktml_products_v1',savedProducts);autosave();renderProducts();notify(a.ready?'Análise salva com sucesso.':'Rascunho salvo; custos ainda não conferidos.');}
function duplicate(){const p=form();currentId=null;fill({...p,name:(p.name||'Novo produto')+' (cópia)'});autosave();notify('Cópia em edição. Salve para adicionar à carteira.');}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function renderProducts(){savedProducts=savedProducts.filter(x=>x&&typeof x==='object'&&x.data&&typeof x.data==='object');text('nProducts',String(savedProducts.length));const query=$('productSearch').value.trim().toLowerCase(),filter=$('productFilter').value;const container=$('productList');container.replaceChildren();let shown=0;
for(const item of savedProducts){const p=item.data,a=p._analysisConfirmed?C.analyze(p):{ready:false},v=a.ready?a.verdict:'incompleto';if(filter!=='all'&&v!==filter)continue;if(query&&!((p.name||'').toLowerCase().includes(query)||(p.url||'').toLowerCase().includes(query)))continue;shown++;
const el=document.createElement('div');el.className='productitem';const left=document.createElement('div'),right=document.createElement('div');left.style.minWidth='0';const name=document.createElement('strong');name.textContent=p.name||'(sem nome)';const info=document.createElement('small');info.textContent=`${p.listingType==='premium'?'Premium':p.listingType==='classic'?'Clássico':'Outro'} · Preço: ${money(C.n(p.price))} · ${new Date(item.updated).toLocaleDateString('pt-BR')}`;left.append(name,info);if(!a.ready){const d=document.createElement('small');d.textContent='⚠ Rascunho — clique em Calcular e salve a análise';left.append(d);}
right.className='prodval';const val=document.createElement('strong');val.className=a.ready?(a.blendProfit<0?'minus':'plus'):'';val.textContent=a.ready?money(a.blendProfit):'Incompleto';const acts=document.createElement('div');acts.className='prodactions';const edit=document.createElement('button');edit.textContent='Abrir';edit.onclick=()=>{currentId=item.id;fill(item.data);autosave();navigate('calculator');scrollTo(0,0);};const del=document.createElement('button');del.textContent='Excluir';del.onclick=()=>{if(confirm(`Excluir “${p.name}”?`)){savedProducts=savedProducts.filter(x=>x.id!==item.id);writeStorage('ktml_products_v1',savedProducts);if(currentId===item.id)currentId=null;renderProducts();}};acts.append(edit,del);right.append(val,acts);el.append(left,right);container.append(el);
}if(!shown){const d=document.createElement('div');d.className='empty';d.textContent='Nenhum produto encontrado. Salve sua primeira análise na Calculadora.';container.append(d);}}
function navigate(tab){$$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.page').forEach(b=>b.classList.toggle('active',b.id==='page-'+tab));}
function backup(){return JSON.stringify({format:'kaipiras-tech-lucroml',version:1,exported:new Date().toISOString(),products:savedProducts,settings, draft:form()},null,2);}
function downloadFile(filename,content,type){if(window.NativeBridge&&typeof window.NativeBridge.saveBackup==='function'){window.NativeBridge.saveBackup(filename,content);return;}const blob=new Blob([content],{type}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);}
function importBackup(file){if(!file)return;if(file.size>5e6){notify('Backup acima do limite de 5 MB.',true);return;}const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(data.format!=='kaipiras-tech-lucroml'||!Array.isArray(data.products))throw Error('Formato inválido');if(data.products.length>5000)throw Error('Mais de 5.000 itens');if(!confirm(`Importar ${data.products.length} produtos? A carteira atual será substituída.`))return;savedProducts=data.products.filter(x=>x&&x.id&&x.data&&typeof x.data==='object');settings=data.settings&&typeof data.settings==='object'?data.settings:settings;for(const el of $$('[data-config]'))el.value=settings[el.dataset.config]??'';writeStorage('ktml_products_v1',savedProducts);writeStorage('ktml_settings_v1',settings);currentId=null;fill(data.draft&&typeof data.draft==='object'?data.draft:defaultDraft());autosave();renderProducts();navigate('products');notify('Backup importado.');}catch(e){notify('Não foi possível importar: '+e.message,true);}};reader.readAsText(file);}
function applyDefaults(){settings={...settings,...Object.fromEntries($$('[data-config]').map(el=>[el.dataset.config,el.value]))};writeStorage('ktml_settings_v1',settings);const p=form();p.targetMargin=settings.targetDefault||p.targetMargin;
const key=p.listingType==='premium'?'premiumDefault':p.listingType==='classic'?'classicDefault':null;if(key&&settings[key]!==undefined&&settings[key]!=='')p.commission=settings[key];fill(p);autosave();navigate('calculator');notify('Padrões aplicados à análise atual.');}
function applyListing(){const p=form(),key=p.listingType==='premium'?'premiumDefault':p.listingType==='classic'?'classicDefault':null;if(key&&settings[key]!==undefined&&settings[key]!==''){$('commission').value=settings[key];notify('Comissão padrão preenchida. Confira na categoria.');}else{$('commission').value='';notify('Tipo de anúncio alterado. Informe a comissão correta para este anúncio.');}}
function extractMlb(url){const m=(url||'').match(/(?:MLB[-\s]?)(\d{7,})/i);return m?'MLB'+m[1]:null;}
function extractPrices(input){const matches=[...String(input).matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi)].map(x=>{const raw=x[1];const amt=/^\d{1,3}(?:\.\d{3})+$/.test(raw)?raw.replace(/\./g,''):raw;return C.n(amt);}).filter(x=>Number.isFinite(x)&&x>0);return [...new Set(matches)].slice(0,15);}

function renderOCR(ocr){text('ocrText',ocr||'Nenhum texto reconhecido. Confira o print manualmente.');const options=extractPrices(ocr),sel=$('ocrPrices');sel.replaceChildren();for(const value of options){const opt=document.createElement('option');opt.value=String(value);opt.textContent=money(value);sel.append(opt);}lastOcrPrice=options.length?options[0]:null;sel.hidden=options.length===0;$('applyOcr').hidden=options.length===0;if(options.length)$('applyOcr').textContent='Usar preço selecionado';}

window.nativeOcrResult=function(msg){try{const d=typeof msg==='string'?JSON.parse(msg):msg;if(d.error){renderOCR('Falha na leitura: '+d.error);notify('Não foi possível ler a imagem.',true);}else{renderOCR(d.text||'Nenhum texto encontrado.');notify('Leitura concluída; valide o preço sugerido.');}}catch(e){renderOCR('Erro de leitura.');}};
window.nativeItemResult=function(msg){try{const d=typeof msg==='string'?JSON.parse(msg):msg;if(d.error){notify(d.error,true);return;}if(d.title)$('name').value=d.title;if(typeof d.price==='number'&&d.price>0)$('price').value=String(d.price);if(d.listing_type_id){$('listingType').value=d.listing_type_id==='gold_pro'?'premium':d.listing_type_id==='gold_special'?'classic':'free';applyListing();}hasCalculated=false;render();autosave();notify('Dados públicos carregados. Confirme preço e tarifas antes de salvar.');}catch(e){notify('Resposta externa inválida.',true);}};
async function importLink(){const url=$('url').value.trim(),id=extractMlb(url);if(!id){notify('Link guardado. Para importação automática use um anúncio com código MLB.',true);return;}
notify('Consultando dados públicos do produto...');if(window.NativeBridge&&typeof window.NativeBridge.importItem==='function'){window.NativeBridge.importItem(id);return;}
try{const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),6500);let res;try{res=await fetch('https://api.mercadolibre.com/items/'+id,{signal:ctrl.signal,mode:'cors',headers:{Accept:'application/json'}});}finally{clearTimeout(timer);}if(!res.ok)throw Error('API retornou '+res.status);const d=await res.json();window.nativeItemResult({title:d.title,price:d.price,listing_type_id:d.listing_type_id});}catch(e){notify('O link foi guardado, mas a API não permitiu importar os dados. Preencha o preço manualmente.',true);}}
async function photoChanged(file){if(!file)return;if(file.size>7e6){notify('A foto deve ter até 7MB.',true);return;}const area=$('photoArea');area.hidden=false;const url=URL.createObjectURL(file);$('photoPreview').src=url;setTimeout(()=>URL.revokeObjectURL(url),60000);renderOCR('Imagem carregada. Verifique as informações visualmente.');
if(window.NativeBridge&&typeof window.NativeBridge.ocrFromImage==='function'){notify('Para reconhecer o texto, use o botão OCR da imagem.');return;}
if(typeof window.TextDetector==='function'&&window.createImageBitmap){try{const bmp=await createImageBitmap(file),detector=new window.TextDetector(),blocks=await detector.detect(bmp);renderOCR(blocks.map(x=>x.rawValue).join('\n'));}catch(e){renderOCR('OCR do navegador indisponível. Preencha preço e nome manualmente usando a imagem.');}}
else renderOCR('O navegador não oferece OCR. A imagem pode ser consultada para preenchimento manual; no APK Android há leitura nativa.');}
async function handlePhotoPicker(){if(window.NativeBridge&&typeof window.NativeBridge.pickImage==='function')window.NativeBridge.pickImage();else $('screenshot').click();}
function init(){initFieldHelp();$('calculateNow').onclick=confirmAndCalculate;$('calculateQuick').onclick=confirmAndCalculate;$('cancelZeros').onclick=()=>$('zeroDialog').close();$('acceptZeros').onclick=commitCalculation;$('helpClose').onclick=()=>$('helpDialog').close();savedProducts=readStorage('ktml_products_v1',[]);if(!Array.isArray(savedProducts))savedProducts=[];settings=readStorage('ktml_settings_v1',{});if(!settings||typeof settings!=='object')settings={};for(const el of $$('[data-config]'))el.value=settings[el.dataset.config]??(el.dataset.config==='targetDefault'?'20':'');const prev=readStorage('ktml_draft_v1',null);currentId=prev?.id||null;let initial=prev?.data||defaultDraft();if(initial.taxRegime==='pf' && (initial.tax===undefined||initial.tax===null||String(initial.tax).trim()===''))initial={...initial,tax:'10',pfTaxMode:'provisional10'};fill(initial);renderProducts();
for(const el of FIELDS){
  el.addEventListener('input',()=>{
    if(el.id==='tax' && $('taxRegime').value==='pf')$('pfTaxMode').value='manual';
    hasCalculated=false;zeroAssumptions=[];render();autosave();
  });
  el.addEventListener('change',()=>{
    if(el.id==='listingType')applyListing();
    if(el.id==='taxRegime'){
      const v=el.value;
      if(v!=='pf' && $('pfTaxMode').value==='provisional10' && C.n($('tax').value)===10){
        $('tax').value='0';$('pfTaxMode').value='';
        notify('Reserva provisória de CPF retirada; configure os impostos do novo regime.');
      }else if(v==='pf' && ($('tax').value.trim()===''||($('tax').value==='0' && $('pfTaxMode').value!== 'manual'))){
        $('tax').value='10';$('pfTaxMode').value='provisional10';
      }
    }
    hasCalculated=false;zeroAssumptions=[];render();autosave();
  });
}
$$('.tabs button').forEach(b=>b.onclick=()=>navigate(b.dataset.tab));$('newProduct').onclick=newProduct;$('resetProduct').onclick=()=>{if(confirm('Limpar todos os campos do produto atual?'))newProduct();};$('saveProduct').onclick=saveProduct;$('duplicateProduct').onclick=duplicate;$('linkImport').onclick=importLink;
$('screenshot').onchange=e=>photoChanged(e.target.files?.[0]);$('nativeScreenshot').onclick=handlePhotoPicker;$('applyOcr').onclick=()=>{if(lastOcrPrice!==null){$('price').value=$('ocrPrices').value;hasCalculated=false;render();autosave();notify('Preço copiado da imagem. Confira se é o preço à vista.');}};
if(window.NativeBridge&&typeof window.NativeBridge.pickImage==='function'){$('nativeScreenshot').hidden=false;$('nativeScreenshot').textContent='Reconhecer texto (Android)';}
$('applyTaxEstimate').onclick=()=>{const proposed=getTaxProposal(form());if(!proposed.ready)return;const p=form();$('tax').value=proposed.tax;$('dasMeiUnit').value=proposed.dasMeiUnit;hasCalculated=false;render();autosave();notify(proposed.mode==='mei'?'DAS rateado aplicado. Imposto percentual definido como zero.':'Alíquota estimada aplicada; confira seu contador.');};
$('applyIdealAcos').onclick=()=>{const p=form(),r=C.acosForProfit(p,p.adsPreserveProfit);if(!r.ready||r.idealAcos<=0){notify('Defina uma meta de lucro viável antes de aplicar.',true);return;}
$('adsMode').value='acos';$('adsAcos').value=(Math.floor(r.idealAcos*100)/100).toFixed(2);$('adsShare').value='100';hasCalculated=false;render();autosave();notify('ACOS ideal aplicado. Cenário de Ads definido para 100% das vendas.');};
$('exportJSON').onclick=()=>downloadFile('kaipirastech-lucroml-backup.json',backup(),'application/json');$('backupSettings').onclick=()=>downloadFile('kaipirastech-lucroml-backup.json',backup(),'application/json');$('importJSON').onchange=e=>{importBackup(e.target.files?.[0]);e.target.value='';};$('productSearch').oninput=renderProducts;$('productFilter').onchange=renderProducts;$('applyDefaults').onclick=applyDefaults;
$('wipeData').onclick=()=>{if(confirm('Apagar todos os produtos, configurações e rascunho? Esta ação não pode ser desfeita.')){for(const k of ['ktml_products_v1','ktml_settings_v1','ktml_draft_v1']){try{localStorage.removeItem(k);}catch(_){}}savedProducts=[];settings={};newProduct();renderProducts();notify('Dados locais apagados.');}};
window.addEventListener('online',()=>text('netLabel','Online · dados locais'));window.addEventListener('offline',()=>text('netLabel','Offline · dados locais'));text('netLabel',navigator.onLine?'Online · dados locais':'Offline · dados locais');
// Offline: bundle packaged directly by Capacitor. No service worker required.
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
