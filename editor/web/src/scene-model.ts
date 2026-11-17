// 这里只描述作者草稿；引用、身份、组件兼容性和提交仍由Core权威校验。
export type Transform={x:number;y:number;rotation:number;scaleX:number;scaleY:number};
export type Reference={kind:'document'|'entity'|'asset'|'subobject';id:string;type:string;scopeDocumentId:string|null};
export type Component={id:string;type:string;schemaVersion:number;enabled:boolean;data:Record<string,unknown>};
export type Spatial={planeId:string;heightOffset:number;vertical:{min:number;max:number};visualOffset:{x:number;y:number}};
export type Entity={name:string;parentId:string|null;transform:Transform;sprite?:{assetId:string}|null;
  spatial?:Spatial;components?:Record<string,Component>;extensions:Record<string,unknown>};
export type Scene={name:string;planes?:Record<string,{name:string;baseHeight:number}>;entities:Record<string,Entity>;extensions:Record<string,unknown>};
export type NumberDraft={text:string;valid:boolean};
