// Decompiled with JetBrains decompiler
// Type: PtsGonderme.Utils
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System.IO;

#nullable disable
namespace PtsGonderme
{
  public class Utils
  {
    public static void CopyDirectory(string sourcePath, string destPath)
    {
      foreach (string file in Directory.GetFiles(sourcePath))
      {
        FileInfo fileInfo = new FileInfo(file);
        string destFileName = Path.Combine(destPath, fileInfo.Name);
        File.Copy(file, destFileName, true);
      }
    }
  }
}
