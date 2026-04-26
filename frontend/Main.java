// import java.io.*;
// class Main {
//     public static void main(String[] args) {
//         System.out.println("Char Stream");
//         try{
//             FileReader o1=new FileReader("source.txt");
//             FileWriter o2=new FileWriter("dest.txt");
//             int data;
//             while((data = o1.read())!=-1){
//                 o2.write(data);
//             }
//             o1.close();
//             o2.close();
//         }catch(Exception e){
//             System.out.println(e);
//         }
//         System.out.println("Done");
//     }
// }

import java.io.*;
class Main {
    public static void main(String[] args) {
        System.out.println("Char Stream");
        try{
            BufferedReader o1=new BufferedReader(new FileReader("C:\\Users\\wwwsa\\OneDrive\\Desktop\\source.txt"));
            BufferedWriter o2=new BufferedWriter(new FileWriter("C:\\Users\\wwwsa\\OneDrive\\Desktop\\dest.txt"));
            int data;
            while((data = o1.read())!=null){
                o2.write(data);
            }
            o1.close();
            o2.close();
        }catch(Exception e){
            System.out.println(e);
        }
        System.out.println("Done");
    }
}