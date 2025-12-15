// Decompiled with JetBrains decompiler
// Type: PtsGonderme.ZipClass
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using System.IO;

#nullable disable
namespace PtsGonderme
{
  internal class ZipClass
  {
    public void CreateSample(string outPathname, string folderName)
    {
      ZipOutputStream zipStream = new ZipOutputStream((Stream) File.Create(outPathname));
      zipStream.SetLevel(3);
      int folderOffset = folderName.Length + (folderName.EndsWith("\\") ? 0 : 1);
      this.CompressFolder(folderName, zipStream, folderOffset);
      zipStream.IsStreamOwner = true;
      ((Stream) zipStream).Close();
    }

    private void CompressFolder(string path, ZipOutputStream zipStream, int folderOffset)
    {
      foreach (string file in Directory.GetFiles(path))
      {
        FileInfo fileInfo = new FileInfo(file);
        zipStream.PutNextEntry(new ZipEntry(ZipEntry.CleanName(file.Substring(folderOffset)))
        {
          DateTime = fileInfo.LastWriteTime,
          Size = fileInfo.Length
        });
        byte[] numArray = new byte[4096];
        using (FileStream fileStream = File.OpenRead(file))
          StreamUtils.Copy((Stream) fileStream, (Stream) zipStream, numArray);
        zipStream.CloseEntry();
      }
      foreach (string directory in Directory.GetDirectories(path))
        this.CompressFolder(directory, zipStream, folderOffset);
    }
  }
}
