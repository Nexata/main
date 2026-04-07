declare module '*.hbs' {
	const content: string;
	export default content;
}

declare module 'pdfjs-dist' {
	export * from '../node_modules/pdfjs-dist/types/src/pdf';
}
