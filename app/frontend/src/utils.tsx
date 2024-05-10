export const isACompletion = (object: any): object is Completion => {
    return 'message' in object;
} 
  
export const isAMessage = (object: any): object is Message => {
    return 'role' in object;
}
  
export const isAToastMessage = (object: any): object is ToastMessage => {
    return 'toastMessage' in object;
}