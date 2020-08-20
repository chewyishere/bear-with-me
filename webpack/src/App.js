import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import {ITEMS} from './json/items';
import Bear from './components/Bear';
import Item from './components/Item';
import Form from './components/Form';
import { shadowVert, shadowFrag} from './components/glsl/shadow'
import { OldFilmFilter } from 'pixi-filters';


export default class App extends PIXI.Application {
    constructor(){
        super({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0xf6d9b1,
        });
        document.body.appendChild(this.view);

        this.items = [];
        this.prevAnim = 0;
        this.currentItem = null;
        this.currentIdx = 0;

        this.ticker = PIXI.Ticker.shared;
        this.scenes = [new PIXI.Container(), new PIXI.Container()];
     
        this.init();
        this.form = new Form();

        this.getBear = this.getBear.bind(this);
        this.walkBear = this.walkBear.bind(this);
        
    }

    init() {
        this.stop();
        window.addEventListener('resize', this.onResize.bind(this))
        this.setupWorld();
        this.getBear()
        this.initFilters();
    }

    initFilters(){
        this.shadowFilter = new PIXI.Filter(shadowVert, shadowFrag);
        this.shadowFilter.padding = 500;
        this.oldFilmFilter = new OldFilmFilter({
            sepia: 1,
            noise: 0.11,
            vignetting: .35,
            scratch: 0.3,
          }, 0)
        this.scenes[0].filters = [this.oldFilmFilter]
        this.ticker.add(()=>{
            this.oldFilmFilter.seed = Math.random()
        })
    }

    setupWorld() {
        this.scenes.forEach(scene => {
            scene.width = this.renderer.width;
            scene.height = this.renderer.height;
            scene.x = 0;
            scene.y = 0;
            this.stage.addChild(scene)
        });
    }
    getStartIdx(){
        let idx = 5;
        let h = new Date().getHours();
        if(h < 9){
        } else if (h >= 9 || h < 12){
           return idx + 3;
        } else if (h >= 12 || h < 14){
            return idx + 2;
        } else if (h >= 14 || h < 19){
            return idx + 3;
        } else if (h >= 19 || h < 21){
            return idx + 2;
        } else {
            return idx + 1;
        }
    }

    getBear() {
        this.loader.add('bears', './assets/bear/bear.json').load(this.onBearLoaded.bind(this));
    }
    onBearLoaded(loader, res) {
        this.bear = new Bear(
            res.bears.spineData,
            this.animate.bind(this),
            this.sendLove.bind(this),
        );
        this.bear.filters = [this.shadowFilter];
        this.getAsset();
    }
        
    getAsset() {
        ITEMS.forEach((_item,idx) => {
            let pos = this.getPos(_item, 'itemPos');
            let size = this.getSize(_item.size);
            let item = new Item(_item, pos, size, idx, this.walkBear, this.subAssetsLoaded.bind(this));
            if(_item.subAssetsName){
                this.loader.add('seq', `assets/items/${_item.session}/${_item.subAssetsName}.json`).load(item.loadSubAssets);
            }
            this.items.push(item);
        })
    }

    subAssetsLoaded() {
       // this.setActiveScene(0);
        this.updateSession(ITEMS[this.getStartIdx()])
        this.checkReachedItem(true)
        this.bear.setPos(this.getCurAvatarPos()); 
        this.bear.setSize(this.getSize(0.5)); 
        this.items.forEach(_item => {
            _item.addShadow();
            this.scenes[_item.scene].addChild(_item);
        });
        this.scenes[0].addChild(this.bear);
        this.updateShadow(false);
        this.start();
    }

    updateShadow(walk){
       if (walk){
            this.shadowFilter.uniforms.shadowDirection = [0, -0.3]
             this.ticker.add(this.shadowTicker, this);
       } else{
            this.ticker.remove(this.shadowTicker, this);
            this.shadowFilter.uniforms.shadowDirection = this.currentItem.avatarShadowDir;
            this.shadowFilter.uniforms.floorY =  this.getCurAvatarPos().y + this.getShadowY(this.currentItem.avatarShadowY);
       };
    }

    updateSession(item){
        this.items.forEach( (_item, _idx) => {
           if (_item.name === item.session) {
                this.currentItem = _item;
                this.currentIdx = _idx;
           }
        });
    }

    setActiveScene(idx){
        this.scenes.forEach((_scene, _idx)=>{
            let active = _idx === idx; 
            _scene.alpha = active;
            _scene.children.forEach(child =>{
                child.setActive(active);
            })
        });
    }

    walkBear(idx){
        if(idx === 2) {
           this.openDoor();
        } else {
            this.updateShadow(true);
            this.toggleItemAnim(1);
            this.prevAnim = 0;
            this.updateSession(ITEMS[idx]);
            this.bear.move(this.getPos(this.currentItem, 'avatarPos'), this.checkReachedItem.bind(this))
        }
    }

    openDoor(){
        this.setActiveScene(1);
    }
    
    toggleItemAnim(val){
        this.currentItem.setActive(val);
        if (this.currentItem.interaction === 'fade'){
            gsap.to(this.currentItem, {alpha: val, duration: 0.2});    
        }
        if (this.currentItem.hasAnim === true){
            let fadeItem = this.items[this.currentIdx + 1];
            gsap.to(fadeItem, {alpha: val, duration: 0.2});  
            this.animate(val); 
        }
    }
    checkReachedItem(init){
        this.toggleItemAnim(0);
        this.bear.setCurrentAnim(this.currentItem.avatarAnim, init)
        this.bear.setHitArea(this.getCurAvatarPos(), this.currentItem.hitAreaOffset); 
        this.updateShadow(false);
    }

    onResize() {
        if(window.innerWidth > 1024 && window.innerWidth < 1900){
            this.renderer.resize(window.innerWidth, window.innerHeight)
            this.bear.setPos(this.getCurAvatarPos()); 
            this.bear.setSize(this.getSize(0.5)); 
            this.items.forEach(item => {
                let itemPos = this.getPos(item, 'itemPos');
                let itemSize = this.getSize(item.size);
                item.setPos(itemPos);
                item.setSize(itemSize);
                item.updateShadowY();
            });
            this.bear.setHitArea(this.getCurAvatarPos(), this.currentItem.hitAreaOffset);
            this.updateShadow();
        }
    }

    addItemShadow(dir, y){
        this.shadowFilter.uniforms.shadowDirection = dir;
        this.shadowFilter.uniforms.floorY = y;
    }

    animate(play) {
        if(this.currentItem.hasAnim) {
            switch(play) {
                case 0:
                    this.currentItem.play('active');    
                break;
                case 1:
                    this.currentItem.stop();
                break;
                case 2:
                    this.currentItem.play('active-look');
                break;
                default:
                    this.currentItem.play('active');
            }
        };
    }

    sendLove(){
       this.form.show();
    }

    shadowTicker() {
        this.shadowFilter.uniforms.floorY =  this.bear.bear.toGlobal(new PIXI.Point(0, 0)).y + this.getShadowY(0.3)
    }

    getCurAvatarPos(){
        return this.getPos(this.currentItem, 'avatarPos');
    }

    getPos(item, posName){
        let pos = {
            x: this.renderer.width * item[posName].x,
            y: this.renderer.height * item[posName].y
        };
        return pos;
    }

    getShadowY(y){
        return this.bear.height * y
    }

    getSize(size){
        return this.renderer.width * size * 0.0007;
    }


}
