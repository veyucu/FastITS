// Decompiled with JetBrains decompiler
// Type: PtsGonderme.DatabaseConfig
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

#nullable disable
namespace PtsGonderme
{
  public class DatabaseConfig
  {
    public string DbServer;
    public string DbName;
    public string DbUser;
    public string DbPass;

    public DatabaseConfig(string DbServer, string DbName, string DbUser, string DbPass)
    {
      this.DbServer = DbServer;
      this.DbName = DbName;
      this.DbUser = DbUser;
      this.DbPass = DbPass;
    }
  }
}
