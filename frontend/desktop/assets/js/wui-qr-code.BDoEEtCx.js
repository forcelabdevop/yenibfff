import{o as e}from"./rolldown-runtime.C_s2cVnS.js";import{S as t,_ as n,b as r,o as i,p as a,u as o,v as s}from"./wui-text.BBpDzk6V.js";import"./wui-image.DGep5uk3.js";import{t as c}from"./browser.DZxfjywh.js";var l=e(c()),u=.1,d=2.5,f=7;function p(e,t,n){return e!==t&&(e-t<0?t-e:e-t)<=n+u}function m(e,t){let n=Array.prototype.slice.call(l.create(e,{errorCorrectionLevel:t}).modules.data,0),r=Math.sqrt(n.length);return n.reduce((e,t,n)=>(n%r===0?e.push([t]):e[e.length-1].push(t))&&e,[])}var h={generate({uri:e,size:n,logoSize:r,padding:i=8,dotColor:a=`var(--apkt-colors-black)`}){let o=[],s=m(e,`Q`),c=(n-2*i)/s.length,l=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];l.forEach(({x:e,y:n})=>{let r=(s.length-f)*c*e+i,u=(s.length-f)*c*n+i,d=.45;for(let e=0;e<l.length;e+=1){let n=c*(f-e*2);o.push(t`
            <rect
              fill=${e===2?`var(--apkt-colors-black)`:`var(--apkt-colors-white)`}
              width=${e===0?n-10:n}
              rx= ${e===0?(n-10)*d:n*d}
              ry= ${e===0?(n-10)*d:n*d}
              stroke=${a}
              stroke-width=${e===0?10:0}
              height=${e===0?n-10:n}
              x= ${e===0?u+c*e+10/2:u+c*e}
              y= ${e===0?r+c*e+10/2:r+c*e}
            />
          `)}});let u=Math.floor((r+25)/c),h=s.length/2-u/2,g=s.length/2+u/2-1,_=[];s.forEach((e,t)=>{e.forEach((e,n)=>{if(s[t][n]&&!(t<f&&n<f||t>s.length-8&&n<f||t<f&&n>s.length-8)&&!(t>h&&t<g&&n>h&&n<g)){let e=t*c+c/2+i,r=n*c+c/2+i;_.push([e,r])}})});let v={};return _.forEach(([e,t])=>{v[e]?v[e]?.push(t):v[e]=[t]}),Object.entries(v).map(([e,t])=>{let n=t.filter(e=>t.every(t=>!p(e,t,c)));return[Number(e),n]}).forEach(([e,n])=>{n.forEach(n=>{o.push(t`<circle cx=${e} cy=${n} fill=${a} r=${c/d} />`)})}),Object.entries(v).filter(([e,t])=>t.length>1).map(([e,t])=>{let n=t.filter(e=>t.some(t=>p(e,t,c)));return[Number(e),n]}).map(([e,t])=>{t.sort((e,t)=>e<t?-1:1);let n=[];for(let e of t){let t=n.find(t=>t.some(t=>p(e,t,c)));t?t.push(e):n.push([e])}return[e,n.map(e=>[e[0],e[e.length-1]])]}).forEach(([e,n])=>{n.forEach(([n,r])=>{o.push(t`
              <line
                x1=${e}
                x2=${e}
                y1=${n}
                y2=${r}
                stroke=${a}
                stroke-width=${c/(d/2)}
                stroke-linecap="round"
              />
            `)})}),o}},g=a`
  :host {
    position: relative;
    user-select: none;
    display: block;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    width: 100%;
    height: 100%;
    background-color: ${({colors:e})=>e.white};
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  :host {
    border-radius: ${({borderRadius:e})=>e[4]};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([data-clear='true']) > wui-icon {
    display: none;
  }

  svg:first-child,
  wui-image,
  wui-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    box-shadow: inset 0 0 0 4px ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[6]};
  }

  wui-image {
    width: 25%;
    height: 25%;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  wui-icon {
    width: 100%;
    height: 100%;
    color: #3396ff !important;
    transform: translateY(-50%) translateX(-50%) scale(0.25);
  }

  wui-icon > svg {
    width: inherit;
    height: inherit;
  }
`,_=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},v=class extends s{constructor(){super(...arguments),this.uri=``,this.size=500,this.theme=`dark`,this.imageSrc=void 0,this.alt=void 0,this.arenaClear=void 0,this.farcaster=void 0}render(){return this.dataset.theme=this.theme,this.dataset.clear=String(this.arenaClear),r`<wui-flex
      alignItems="center"
      justifyContent="center"
      class="wui-qr-code"
      direction="column"
      gap="4"
      width="100%"
      style="height: 100%"
    >
      ${this.templateVisual()} ${this.templateSvg()}
    </wui-flex>`}templateSvg(){return t`
      <svg viewBox="0 0 ${this.size} ${this.size}" width="100%" height="100%">
        ${h.generate({uri:this.uri,size:this.size,logoSize:this.arenaClear?0:this.size/4})}
      </svg>
    `}templateVisual(){return this.imageSrc?r`<wui-image src=${this.imageSrc} alt=${this.alt??`logo`}></wui-image>`:this.farcaster?r`<wui-icon
        class="farcaster"
        size="inherit"
        color="inherit"
        name="farcaster"
      ></wui-icon>`:r`<wui-icon size="inherit" color="inherit" name="walletConnect"></wui-icon>`}};v.styles=[o,g],_([n()],v.prototype,`uri`,void 0),_([n({type:Number})],v.prototype,`size`,void 0),_([n()],v.prototype,`theme`,void 0),_([n()],v.prototype,`imageSrc`,void 0),_([n()],v.prototype,`alt`,void 0),_([n({type:Boolean})],v.prototype,`arenaClear`,void 0),_([n({type:Boolean})],v.prototype,`farcaster`,void 0),v=_([i(`wui-qr-code`)],v);