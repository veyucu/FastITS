// Decompiled with JetBrains decompiler
// Type: PtsGonderme.ArgumentHelper
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

#nullable disable
namespace PtsGonderme
{
  public class ArgumentHelper
  {
    private static string Seperator()
    {
      return "  -----------------------------------------------------------------  \n";
    }

    public static string FindPackageHelp()
    {
      return ArgumentHelper.Seperator() + "program_adi paket $destinationGLN $destination_userName $destination_pwd $db_server $db_name $db_username $db_password \n";
    }

    public static string FindSendFileHelp()
    {
      return ArgumentHelper.Seperator() + "program_adi sendfile $sourceGLN $destinationGLN $userName $pwd $filePath $url $filename \n";
    }

    public static string GeneralHelp() => ArgumentHelper.FindPackageHelp();
  }
}
