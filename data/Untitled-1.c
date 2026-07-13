#include<stdio.h>
#include<string.h>
typedef struct{
	char mhv[10],ht[30];
	int gt,ns;
	float dtb;
}quanlyhocvien;
const char* gioitinh(int gt){
	switch(gt){
		case 1:return"Nam";
		case 2;return"Nu";
		default:return"not found";
	}
}
int main(){
	int n,i;
	printf("Nhap so luong hoc vien:");scanf("%d",&n);
	quanlyhocvien ds[n];
	for(i=0;i<n;i++){
		printf("=====Nhap Thong Tin Sinh Vien Thu %d=====\n",i+1);
		printf("Nhap ma hoc vien:");fflush(stdin);gets(ds[i].mhv);
		printf("Nhap ho ten:");fflush(stdin);gets(ds[i].ht);
		printf("Nhap gioi tinh (1:Nam, 2:Nu):");scanf("%d",&ds[i].gt);
		printf("Nhap nam sinh:");scanf("%d",&ds[i].ns);
		printf("Nhap diem trung binh:");scanf("%f",&ds[i].dtb);
	}
	//
	printf("\n=====Danh Sach Sinh Vien=====\n");
	printf("%-10s%-30s%-10s%-10s%-10s\n",
		"Ma HV","Ho Ten","Gioi Tinh","Nam Sinh","Diem TB");
	for(i=0;i<n;i++){
		printf("%-10s%-30s%-10s%-10d%-10.2f\n",
		    ds[i].mhv,
			ds[i].ht,
			gioitinh(ds[i].gt),
			ds[i].ns,ds[i].dtb);
	}
	//
	printf("\n=====Danh Sach Sinh Vien Co Diem Trung Binh >= 7.5=====\n");
	printf("%-10s%-30s%-10s%-10s%-10s\n",
		"Ma HV","Ho Ten","Gioi Tinh","Nam Sinh","Diem TB");
	for(i=0;i<n;i++){
		if(ds[i].dtb>=7.5){
			printf("%-10s%-30s%-10s%-10d%-10.2f\n",
		    ds[i].mhv,
			ds[i].ht,
			gioitinh(ds[i].gt),
			ds[i].ns,ds[i].dtb);
		}
    //
	int found = 0;
	printf("\n=====Cap Nhat Diem Trung Bing Theo Ma Hoc Vien=====\n");
	char mhv[10];float dtb;
	printf("Nhap ma hoc vien can cap nhat diem trung binh:");fflush(stdin);gets(mhv);
	printf("Nhap diem trung binh moi:");scanf("%f",&dtb);
	for(i=0;i<n;i++){
		if(strcmp(ds[i].mhv,mhv)==0){
			ds[i].dtb=dtb;
			found = 1;
			break;
		}
	}	
	if(found==0) printf("Khong tim thay hoc vien co ma %s!\n",mhv);
	else{
		printf("Cap nhat diem trung binh thanh cong!\n");

		printf("\n=====Danh Sach Sinh Vien Sau Khi Cap Nhat=====\n");	
		printf("%-10s%-30s%-10s%-10s%-10s\n",
			"Ma HV","Ho Ten","Gioi Tinh","Nam Sinh","Diem TB");
		for(i=0;i<n;i++){
			printf("%-10s%-30s%-10s%-10d%-10.2f\n",
			    ds[i].mhv,
				ds[i].ht,
				gioitinh(ds[i].gt),
				ds[i].ns,ds[i].dtb);
			}
	//
	quanlyhocvien temp;
	for(i=0;i<n-1;i++){
		for(int j=i+1;j<n;j++){
			if(ds[i].dtb<ds[j].dtb){
				temp=ds[i];
				ds[i]=ds[j];
				ds[j]=temp;
			}
		}
	}
	printf("\n=====Danh Sach Sinh Vien Sau Khi Sap Xep Theo Diem Trung Binh Giam Dan=====\n");
	printf("%-10s%-30s%-10s%-10s%-10s\n",	
		"Ma HV","Ho Ten","Gioi Tinh","Nam Sinh","Diem TB");	
	for(i=0;i<n;i++){
		printf("%-10s%-30s%-10s%-10d%-10.2f\n",
		    ds[i].mhv,
			ds[i].ht,
			gioitinh(ds[i].gt),
			ds[i].ns,ds[i].dtb);
    }
	vitri = -1;
	printf("Nhap ma hoc vien can xoa:");fflush(stdin);gets(mhv);
	for(i=0;i<n;i++){
		if(strcmp(ds[i].mhv,mhv)==0){
			vitri=i;
			break;
		}
	}
	if(vitri==-1) printf("Khong tim thay hoc vien co ma %s!\n",mhv);
	else{
		for(i=vitri;i<n-1;i++){
			ds[i]=ds[i+1];
		}
		n--;
		printf("Xoa hoc vien thanh cong!\n");
	printf("\n=====Danh Sach Sinh Vien Sau Khi Xoa=====\n");
	printf("%-10s%-30s%-10s%-10s%-10s\n",
		"Ma HV","Ho Ten","Gioi Tinh","Nam Sinh","Diem TB");
	for(i=0;i<n;i++){
		printf("%-10s%-30s%-10s%-10d%-10.2f\n",
		    ds[i].mhv,
			ds[i].ht,
			gioitinh(ds[i].gt),
			ds[i].ns,ds[i].dtb);
	}
}