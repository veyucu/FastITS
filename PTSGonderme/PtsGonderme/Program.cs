// Decompiled with JetBrains decompiler
// Type: PtsGonderme.Program
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using ICSharpCode.SharpZipLib.Zip;
using Newtonsoft.Json;
using PtsGonderme.NHLService;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

#nullable disable
namespace PtsGonderme
{
  internal class Program
  {
    private static string WorkDirectory = "";
    private static string SonucDirectory = "";
    private static string ZipsDirectory = "";
    private static string ParametersFile = "";
    private static XmlDocument xdXML = new XmlDocument();
    private static PaketXml paketXml = new PaketXml();
    private static CarrierType currentCarrierType = new CarrierType();
    private static CarrierType IkicurrentCarrierType = new CarrierType();
    private static CarrierType UccurrentCarrierType = new CarrierType();
    private static CarrierType DortcurrentCarrierType = new CarrierType();
    private static CarrierType BescurrentCarrierType = new CarrierType();
    private static CarrierType AlticurrentCarrierType = new CarrierType();
    private static ProductList productList = new ProductList();

    private static void Main(string[] args)
    {
      ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
      try
      {
        if (args.Length == 0)
          return;
        string environmentVariable = Environment.GetEnvironmentVariable("LocalAppData");
        if (args[0].ToLower() == "sendfile" && args.Length == 9)
        {
          environmentVariable = args[8];
          Program.ZipsDirectory = Path.Combine(environmentVariable, "zips");
          if (!Directory.Exists(Program.ZipsDirectory))
            Directory.CreateDirectory(Program.ZipsDirectory);
        }
        if (args[0].ToLower() == "paket" && args.Length == 11)
          environmentVariable = args[10];
        Program.WorkDirectory = Path.Combine(environmentVariable, "ptsxml");
        Program.SonucDirectory = Path.Combine(Program.WorkDirectory, "sonuc");
        Program.ParametersFile = Path.Combine(Program.SonucDirectory, "parametreler.txt");
        Directory.CreateDirectory(Program.SonucDirectory);
        TextWriter textWriter1 = (TextWriter) new StreamWriter(Program.ParametersFile);
        TextWriter textWriter2 = textWriter1;
        int num = args.Length;
        string str1 = "Parametre sayisi : " + num.ToString();
        textWriter2.WriteLine(str1);
        for (int index = 0; index < args.Length; ++index)
        {
          TextWriter textWriter3 = textWriter1;
          num = index + 1;
          string str2 = "parametre: " + num.ToString() + ": " + args[index];
          textWriter3.WriteLine(str2);
        }
        textWriter1.Close();
        if (args.Length == 0)
          Console.WriteLine(ArgumentHelper.GeneralHelp());
        else if (args.Length == 1)
        {
          Console.WriteLine(ArgumentHelper.FindPackageHelp());
        }
        else
        {
          switch (args[0].ToLower())
          {
            case "paket":
              if (args.Length == 11)
              {
                try
                {
                  Program.FindPackage(args[1], args[2], args[3], new DatabaseConfig(args[4], args[5], args[6], args[7]), args[8], args[9]);
                  break;
                }
                catch (Exception ex)
                {
                  TextWriter textWriter4 = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, "hata_genel.txt"));
                  textWriter4.WriteLine("Genel hata: " + ex.ToString());
                  textWriter4.Close();
                  break;
                }
              }
              else
              {
                Console.WriteLine(ArgumentHelper.FindPackageHelp());
                break;
              }
            case "GetTransferId":
              if (args.Length == 11)
              {
                try
                {
                  Program.GetTranferId(args[1], args[2], args[3], new DatabaseConfig(args[4], args[5], args[6], args[7]), args[8], args[9]);
                  break;
                }
                catch (Exception ex)
                {
                  TextWriter textWriter5 = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, "hata_genel.txt"));
                  textWriter5.WriteLine("Genel hata: " + ex.ToString());
                  textWriter5.Close();
                  break;
                }
              }
              else
              {
                Console.WriteLine(ArgumentHelper.FindPackageHelp());
                break;
              }
            case "sendfile":
              if (args.Length == 9)
              {
                try
                {
                  Program.sendFile(args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
                  break;
                }
                catch (Exception ex)
                {
                  TextWriter textWriter6 = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, "hata_genel.txt"));
                  textWriter6.WriteLine("Genel hata: " + ex.ToString());
                  textWriter6.Close();
                  break;
                }
              }
              else
              {
                Console.WriteLine(ArgumentHelper.FindSendFileHelp());
                break;
              }
            case "localfile":
              if (args.Length == 7)
              {
                try
                {
                  Program.LocalFile(args[1], args[2], new DatabaseConfig(args[3], args[4], args[5], args[6]));
                  break;
                }
                catch (Exception ex)
                {
                  TextWriter textWriter7 = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, "hata_genel.txt"));
                  textWriter7.WriteLine("Genel hata: " + ex.ToString());
                  textWriter7.Close();
                  break;
                }
              }
              else
              {
                Console.WriteLine(ArgumentHelper.FindSendFileHelp());
                break;
              }
            case "NHLSipDurum":
              if (args.Length == 8)
              {
                try
                {
                  Program.NhlSipDurumSor(args[1], args[2], args[3], new DatabaseConfig(args[4], args[5], args[6], args[7]));
                  break;
                }
                catch (Exception ex)
                {
                  TextWriter textWriter8 = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, "hata_genel.txt"));
                  textWriter8.WriteLine("Genel hata: " + ex.ToString());
                  textWriter8.Close();
                  break;
                }
              }
              else
              {
                Console.WriteLine(ArgumentHelper.FindSendFileHelp());
                break;
              }
          }
        }
      }
      catch (Exception ex)
      {
        throw;
      }
    }

    private static async Task<string> GetToken(string Kull_Adi, string Sifre)
    {
      HttpClient h = new HttpClient();
      string token;
      try
      {
        StringContent Json = new StringContent(JsonConvert.SerializeObject((object) new
        {
          username = Kull_Adi,
          password = Sifre
        }), Encoding.UTF8, "application/json");
        HttpResponseMessage result = await h.PostAsync("https://its2.saglik.gov.tr/token/app/token/", (HttpContent) Json);
        string jsonResult = await result.Content.ReadAsStringAsync();
        Program.Token response = JsonConvert.DeserializeObject<Program.Token>(jsonResult);
        if (!result.IsSuccessStatusCode)
        {
          Console.WriteLine("PTS Token Alma WS Bağlantı Hatası \n" + jsonResult.ToString());
          throw new ArgumentException("PTS Token Alma WS Bağlantı Hatası \n" + jsonResult.ToString());
        }
        token = response.token;
      }
      finally
      {
        h.Dispose();
      }
      h = (HttpClient) null;
      return token;
    }

    private static async Task<string> sendFile(
      string sourceGLN,
      string destinationGLN,
      string userName,
      string pwd,
      string filePath,
      string url,
      string filename)
    {
      string ysf = "";
      if (!Directory.Exists(filePath))
      {
        Console.WriteLine("PTS Dosya Gönderme Dizin Bulunamadı \n" + filePath);
        throw new ArgumentException("PTS Dosya Gönderme Dizin Bulunamadı \n" + filePath);
      }
      string temp_file = Path.GetTempPath() + destinationGLN + filename + ".zip";
      try
      {
        ZipClass zip = new ZipClass();
        zip.CreateSample(temp_file, filePath);
        filePath = temp_file;
        zip = (ZipClass) null;
      }
      catch (Exception ex)
      {
        string def = "hata_zip_" + filename + ".txt";
        TextWriter tww = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, def));
        tww.WriteLine(ex.Message);
        tww.Close();
        Console.WriteLine("PTS Dosya Gönderme Zip Oluşturma Hatası \n" + ex.Message);
        throw new ArgumentException("PTS Dosya Gönderme Zip Oluşturma Hatası \n" + ex.Message);
      }
      string result = "";
      if (System.IO.File.Exists(filePath))
      {
        HttpClient hc = new HttpClient();
        byte[] bytes = System.IO.File.ReadAllBytes(filePath);
        string Basefile = Convert.ToBase64String(bytes);
        string Token = Program.GetToken(userName, pwd).Result.ToString();
        Console.WriteLine(Token);
        try
        {
          StringContent Json = new StringContent(JsonConvert.SerializeObject((object) new
          {
            receiver = destinationGLN,
            file = Basefile
          }), Encoding.UTF8, "application/json");
          hc.DefaultRequestHeaders.Add("Authorization", "Bearer " + Token);
          Console.WriteLine("PTS Dosya Gönderme Başlıyor...");
          HttpResponseMessage resultJson = hc.PostAsync("https://its2.saglik.gov.tr/pts/app/SendPackage/", (HttpContent) Json).Result;
          Console.WriteLine("PTS Dosya Gönderme Tamamlandı...");
          string jsonResult = await resultJson.Content.ReadAsStringAsync();
          Console.WriteLine("PTS Dosya Gönderme Gelen JSON \n" + jsonResult.ToString());
          Program.SendFile response = JsonConvert.DeserializeObject<Program.SendFile>(jsonResult);
          if (!resultJson.IsSuccessStatusCode)
          {
            Console.WriteLine("PTS Dosya Gönderme WS Bağlantı Hatası \n" + jsonResult.ToString());
            result = "PTS Dosya Gönderme WS Bağlantı Hatası \n" + jsonResult.ToString();
            throw new ArgumentException("PTS Dosya Gönderme WS Bağlantı Hatası \n" + jsonResult.ToString());
          }
          try
          {
            long transferId = long.Parse(response.transferId.ToString());
            result = "Transfer Id : " + transferId.ToString();
            Console.WriteLine("PTS Dosya Gönderme Transfer ID Dosyası Oluşturuluyor \n" + transferId.ToString());
            string abcdef = filename + ".txt";
            TextWriter tw = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, abcdef));
            tw.WriteLine(transferId);
            tw.Close();
            Console.WriteLine("PTS Dosya Gönderme Transfer ID Dosyası Oluşturuldu \n" + Program.SonucDirectory + "/" + abcdef);
            System.IO.File.Copy(filePath, Program.ZipsDirectory + "\\" + destinationGLN + filename + ".zip");
            System.IO.File.Delete(filePath);
            abcdef = (string) null;
            tw = (TextWriter) null;
          }
          catch (Exception ex1)
          {
            Exception ex = ex1;
            string abcdef = "hata_" + filename + ".txt";
            TextWriter tw = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, abcdef));
            try
            {
              result = "Hata : ";
              tw.WriteLine(result);
            }
            catch (Exception ex2)
            {
              result = ex2.Message;
              tw.WriteLine(result);
            }
            tw.Close();
            System.IO.File.Delete(filePath);
            abcdef = (string) null;
            tw = (TextWriter) null;
          }
          Json = (StringContent) null;
          resultJson = (HttpResponseMessage) null;
          jsonResult = (string) null;
          response = (Program.SendFile) null;
        }
        finally
        {
          hc.Dispose();
        }
        hc = (HttpClient) null;
        bytes = (byte[]) null;
        Basefile = (string) null;
        Token = (string) null;
      }
      else
      {
        string abcdef = filename + ".txt";
        TextWriter tw = (TextWriter) new StreamWriter(Path.Combine(Program.SonucDirectory, abcdef));
        tw.WriteLine();
        tw.Close();
        abcdef = (string) null;
        tw = (TextWriter) null;
      }
      string str = result;
      ysf = (string) null;
      TextWriter ysfw = (TextWriter) null;
      temp_file = (string) null;
      result = (string) null;
      return str;
    }

    private static string LocalFile(string sourceGLN, string FilePath, DatabaseConfig dbConfig)
    {
      string str1 = "";
      try
      {
        string str2 = "";
        string[] files = Directory.GetFiles(FilePath);
        if (files[0] == null)
          return "";
        for (int index = 0; index < files.Length; ++index)
        {
          Program.xdXML = (XmlDocument) null;
          Program.xdXML = new XmlDocument();
          Program.xdXML.Load(files[index]);
          using (SqlConnection connection = new SqlConnection("Data Source=" + dbConfig.DbServer + ";Initial Catalog=" + dbConfig.DbName + ";User Id=" + dbConfig.DbUser + ";Password=" + dbConfig.DbPass + ";"))
          {
            connection.Open();
            using (SqlCommand sqlCommand = new SqlCommand("SELECT RIGHT(ISNULL(MAX(TRANSFER_ID),''),12) AS SON_NO FROM ATBLPTSMAS WHERE TRANSFER_ID LIKE 'AYS%'", connection))
            {
              SqlDataReader sqlDataReader = sqlCommand.ExecuteReader();
              while (sqlDataReader.Read())
                str2 = sqlDataReader.GetString(sqlDataReader.GetOrdinal("SON_NO"));
              sqlDataReader.Close();
            }
          }
          if (string.IsNullOrEmpty(str2))
          {
            str2 = "AYS" + Program.paketXml.doldur("1", 12, "0", true);
          }
          else
          {
            string xstr = (Convert.ToInt32(str2) + 1).ToString();
            str2 = "AYS" + Program.paketXml.doldur(xstr, 12, "0", true);
          }
          CarrierType carrierType1 = new CarrierType();
          CarrierType carrierType2 = new CarrierType();
          CarrierType carrierType3 = new CarrierType();
          CarrierType carrierType4 = new CarrierType();
          CarrierType carrierType5 = new CarrierType();
          CarrierType carrierType6 = new CarrierType();
          ProductList productList = new ProductList();
          Program.paketXml.serialNumbers.Clear();
          Program.paketXml.carrierTypes.Clear();
          Program.paketXml.productList.Clear();
          Program.paketXml.IkicarrierTypes.Clear();
          Program.paketXml.UccarrierTypes.Clear();
          Program.paketXml.DortcarrierTypes.Clear();
          Program.paketXml.BescarrierTypes.Clear();
          Program.paketXml.AlticarrierTypes.Clear();
          foreach (XmlNode selectNode in Program.xdXML.SelectNodes("/transfer"))
          {
            if (selectNode.Name == "transfer")
            {
              foreach (XmlNode childNode in selectNode.ChildNodes)
              {
                switch (childNode.Name)
                {
                  case "actionType":
                    Program.paketXml.actionType = childNode.InnerText.Trim();
                    break;
                  case "carrier":
                    Program.BirCarrierOlustur(childNode);
                    break;
                  case "destinationGLN":
                    Program.paketXml.destinationGLN = childNode.InnerText.Trim();
                    break;
                  case "documentDate":
                    Program.paketXml.documentDate = childNode.InnerText.Trim();
                    break;
                  case "documentNumber":
                    Program.paketXml.documentNumber = childNode.InnerText.Trim();
                    break;
                  case "note":
                    Program.paketXml.note = childNode.InnerText.Trim();
                    break;
                  case "shipTo":
                    Program.paketXml.shipTo = childNode.InnerText.Trim();
                    break;
                  case nameof (sourceGLN):
                    Program.paketXml.sourceGLN = childNode.InnerText.Trim();
                    break;
                  case "version":
                    Program.paketXml.version = childNode.InnerText.Trim();
                    break;
                }
              }
            }
          }
          Console.WriteLine("getAndSaveFile XML OKUNUYOR");
          Program.paketXml.SaveToDB(str2, dbConfig);
          Program.xdXML = (XmlDocument) null;
          string str3 = Path.Combine(Path.Combine(Environment.GetEnvironmentVariable("LocalAppData"), "ptsxml"), str2);
          Directory.CreateDirectory(str3);
          Utils.CopyDirectory(FilePath, str3);
          System.IO.File.Delete(files[index]);
        }
      }
      catch (Exception ex)
      {
        str1 = ex.Message;
      }
      return str1;
    }

    private static async Task<string> getAndSaveFile(
      string sourceGLN,
      long transferId,
      string userName,
      string pwd,
      DatabaseConfig dbConfig)
    {
      string result = "";
      string Token = Program.GetToken(userName, pwd).Result.ToString();
      Console.WriteLine(Token);
      HttpClient hc = new HttpClient();
      try
      {
        StringContent Json = new StringContent(JsonConvert.SerializeObject((object) new
        {
          transferId = transferId
        }), Encoding.UTF8, "application/json");
        hc.DefaultRequestHeaders.Add("Authorization", "Bearer " + Token);
        HttpResponseMessage resultJson = hc.PostAsync("https://its2.saglik.gov.tr/pts/app/GetPackage", (HttpContent) Json).Result;
        string jsonResult = await resultJson.Content.ReadAsStringAsync();
        Program.GetFile response = JsonConvert.DeserializeObject<Program.GetFile>(jsonResult);
        if (!resultJson.IsSuccessStatusCode)
        {
          Console.WriteLine("PTS Dosya İndirme WS Bağlantı Hatası \n" + jsonResult.ToString());
          throw new ArgumentException("PTS Dosya İndirme WS Bağlantı Hatası \n" + jsonResult.ToString());
        }
        Console.WriteLine("getAndSaveFile SERVİS BİLGİ GÖNDERİLDİ");
        try
        {
          string fileName = new Random().Next().ToString();
          Console.WriteLine("1");
          Console.WriteLine("2");
          Console.WriteLine("3");
          Console.WriteLine(Program.SonucDirectory);
          string fileDirectory = Path.Combine(Program.SonucDirectory, "dosyalar");
          Console.WriteLine("4");
          Console.WriteLine(fileDirectory);
          fileDirectory = Path.Combine(fileDirectory, fileName);
          Console.WriteLine("5");
          Directory.CreateDirectory(fileDirectory);
          Console.WriteLine("6");
          string filePathWithFileName = fileDirectory + fileName + ".zip";
          Console.WriteLine(filePathWithFileName);
          System.IO.File.WriteAllBytes(filePathWithFileName, Convert.FromBase64String(response.fileStream));
          result = "File : " + filePathWithFileName;
          Console.WriteLine("getAndSaveFile ZİP KAYDEDİLDİ");
          FastZip fz = new FastZip();
          fz.ExtractZip(filePathWithFileName, fileDirectory, "");
          Console.WriteLine("getAndSaveFile ZİPTEN ÇIKARTILDI");
          System.IO.File.Delete(filePathWithFileName);
          string[] fileList = Directory.GetFiles(fileDirectory);
          if (fileList[0] == null)
            return "";
          for (int i = 0; i < fileList.Length; ++i)
          {
            Program.xdXML = (XmlDocument) null;
            Program.xdXML = new XmlDocument();
            Program.xdXML.Load(fileList[i]);
            CarrierType currentCarrierType = new CarrierType();
            CarrierType IkicurrentCarrierType = new CarrierType();
            CarrierType UccurrentCarrierType = new CarrierType();
            CarrierType DortcurrentCarrierType = new CarrierType();
            CarrierType BescurrentCarrierType = new CarrierType();
            CarrierType AlticurrentCarrierType = new CarrierType();
            ProductList productList = new ProductList();
            Program.paketXml.serialNumbers.Clear();
            Program.paketXml.carrierTypes.Clear();
            Program.paketXml.productList.Clear();
            Program.paketXml.IkicarrierTypes.Clear();
            Program.paketXml.UccarrierTypes.Clear();
            Program.paketXml.DortcarrierTypes.Clear();
            Program.paketXml.BescarrierTypes.Clear();
            Program.paketXml.AlticarrierTypes.Clear();
            XmlNodeList xnNode = Program.xdXML.SelectNodes("/transfer");
            foreach (XmlNode node in xnNode)
            {
              if (node.Name == "transfer")
              {
                XmlNodeList transferNodes = node.ChildNodes;
                foreach (XmlNode transferchild in transferNodes)
                {
                  string str = transferchild.Name;
                  string a;
                  switch (str)
                  {
                    case "actionType":
                      Program.paketXml.actionType = transferchild.InnerText.Trim();
                      break;
                    case "carrier":
                      a = Program.BirCarrierOlustur(transferchild);
                      break;
                    case "destinationGLN":
                      Program.paketXml.destinationGLN = transferchild.InnerText.Trim();
                      break;
                    case "documentDate":
                      Program.paketXml.documentDate = transferchild.InnerText.Trim();
                      break;
                    case "documentNumber":
                      Program.paketXml.documentNumber = transferchild.InnerText.Trim();
                      break;
                    case "note":
                      Program.paketXml.note = transferchild.InnerText.Trim();
                      break;
                    case "shipTo":
                      Program.paketXml.shipTo = transferchild.InnerText.Trim();
                      break;
                    case nameof (sourceGLN):
                      Program.paketXml.sourceGLN = transferchild.InnerText.Trim();
                      break;
                    case "version":
                      Program.paketXml.version = transferchild.InnerText.Trim();
                      break;
                  }
                  a = (string) null;
                  str = (string) null;
                }
                transferNodes = (XmlNodeList) null;
              }
            }
            Console.WriteLine("getAndSaveFile XML OKUNUYOR");
            Program.paketXml.SaveToDB(transferId.ToString(), dbConfig);
            Program.xdXML = (XmlDocument) null;
            currentCarrierType = (CarrierType) null;
            IkicurrentCarrierType = (CarrierType) null;
            UccurrentCarrierType = (CarrierType) null;
            DortcurrentCarrierType = (CarrierType) null;
            BescurrentCarrierType = (CarrierType) null;
            AlticurrentCarrierType = (CarrierType) null;
            productList = (ProductList) null;
            xnNode = (XmlNodeList) null;
          }
          string localdata = Environment.GetEnvironmentVariable("LocalAppData");
          string sourceDirectory = Path.Combine(localdata, "ptsxml");
          sourceDirectory = Path.Combine(sourceDirectory, transferId.ToString());
          Directory.CreateDirectory(sourceDirectory);
          Utils.CopyDirectory(fileDirectory, sourceDirectory);
          Directory.Delete(fileDirectory, true);
          fileName = (string) null;
          fileDirectory = (string) null;
          filePathWithFileName = (string) null;
          fz = (FastZip) null;
          fileList = (string[]) null;
          localdata = (string) null;
          sourceDirectory = (string) null;
        }
        catch (Exception ex)
        {
          result = ex.Message;
        }
        Json = (StringContent) null;
        resultJson = (HttpResponseMessage) null;
        jsonResult = (string) null;
        response = (Program.GetFile) null;
      }
      finally
      {
        hc.Dispose();
      }
      return result;
    }

    private static string BirCarrierOlustur(XmlNode xchild)
    {
      if (xchild.Name == "carrier")
      {
        Program.currentCarrierType = new CarrierType();
        XmlAttributeCollection attributes1 = xchild.Attributes;
        XmlAttribute namedItem1 = (XmlAttribute) attributes1.GetNamedItem("carrierLabel");
        if (namedItem1.Name == "carrierLabel")
          Program.currentCarrierType.carrierLabel = namedItem1.Value.Trim();
        XmlAttribute namedItem2 = (XmlAttribute) attributes1.GetNamedItem("containerType");
        if (namedItem2 != null && namedItem2.Name == "containerType")
          Program.currentCarrierType.containerType = namedItem2.Value.Trim();
        foreach (XmlNode childNode in xchild.ChildNodes)
        {
          switch (childNode.Name)
          {
            case "carrier":
              Program.IkiCarrierOlustur(childNode);
              break;
            case "productList":
              Program.productList = new ProductList();
              XmlAttributeCollection attributes2 = childNode.Attributes;
              XmlAttribute namedItem3 = (XmlAttribute) attributes2.GetNamedItem("GTIN");
              if (namedItem3.Name == "GTIN")
                Program.productList.GTIN = namedItem3.Value.Trim();
              XmlAttribute namedItem4 = (XmlAttribute) attributes2.GetNamedItem("lotNumber");
              if (namedItem4.Name == "lotNumber")
                Program.productList.lotNumber = namedItem4.Value.Trim();
              XmlAttribute namedItem5 = (XmlAttribute) attributes2.GetNamedItem("expirationDate");
              if (namedItem5.Name == "expirationDate")
                Program.productList.expirationDate = namedItem5.Value.Trim();
              XmlAttribute namedItem6 = (XmlAttribute) attributes2.GetNamedItem("PONumber");
              if (namedItem6 != null && namedItem6.Name == "PONumber")
                Program.productList.PONumber = namedItem6.Value.Trim();
              IEnumerator enumerator = childNode.ChildNodes.GetEnumerator();
              try
              {
                while (enumerator.MoveNext())
                {
                  XmlNode current = (XmlNode) enumerator.Current;
                  if (current.Name == "serialNumber")
                  {
                    Program.paketXml.serialNumbers.Add(current.InnerText.Trim());
                    Program.paketXml.carrierTypes.Add(Program.currentCarrierType);
                    Program.paketXml.productList.Add(Program.productList);
                    Program.IkicurrentCarrierType = new CarrierType();
                    Program.IkicurrentCarrierType.carrierLabel = "";
                    Program.IkicurrentCarrierType.containerType = "";
                    Program.paketXml.IkicarrierTypes.Add(Program.IkicurrentCarrierType);
                    Program.UccurrentCarrierType = new CarrierType();
                    Program.UccurrentCarrierType.carrierLabel = "";
                    Program.UccurrentCarrierType.containerType = "";
                    Program.paketXml.UccarrierTypes.Add(Program.UccurrentCarrierType);
                    Program.DortcurrentCarrierType = new CarrierType();
                    Program.DortcurrentCarrierType.carrierLabel = "";
                    Program.DortcurrentCarrierType.containerType = "";
                    Program.paketXml.DortcarrierTypes.Add(Program.DortcurrentCarrierType);
                    Program.BescurrentCarrierType = new CarrierType();
                    Program.BescurrentCarrierType.carrierLabel = "";
                    Program.BescurrentCarrierType.containerType = "";
                    Program.paketXml.BescarrierTypes.Add(Program.BescurrentCarrierType);
                    Program.AlticurrentCarrierType = new CarrierType();
                    Program.AlticurrentCarrierType.carrierLabel = "";
                    Program.AlticurrentCarrierType.containerType = "";
                    Program.paketXml.AlticarrierTypes.Add(Program.AlticurrentCarrierType);
                  }
                }
                break;
              }
              finally
              {
                if (enumerator is IDisposable disposable)
                  disposable.Dispose();
              }
          }
        }
      }
      return "";
    }

    private static string IkiCarrierOlustur(XmlNode xchild)
    {
      if (xchild.Name == "carrier")
      {
        Program.IkicurrentCarrierType = new CarrierType();
        XmlAttributeCollection attributes1 = xchild.Attributes;
        XmlAttribute namedItem1 = (XmlAttribute) attributes1.GetNamedItem("carrierLabel");
        if (namedItem1.Name == "carrierLabel")
          Program.IkicurrentCarrierType.carrierLabel = namedItem1.Value.Trim();
        XmlAttribute namedItem2 = (XmlAttribute) attributes1.GetNamedItem("containerType");
        if (namedItem2 != null && namedItem2.Name == "containerType")
          Program.IkicurrentCarrierType.containerType = namedItem2.Value.Trim();
        foreach (XmlNode childNode in xchild.ChildNodes)
        {
          switch (childNode.Name)
          {
            case "carrier":
              Program.UcCarrierOlustur(childNode);
              break;
            case "productList":
              Program.productList = new ProductList();
              XmlAttributeCollection attributes2 = childNode.Attributes;
              XmlAttribute namedItem3 = (XmlAttribute) attributes2.GetNamedItem("GTIN");
              if (namedItem3.Name == "GTIN")
                Program.productList.GTIN = namedItem3.Value.Trim();
              XmlAttribute namedItem4 = (XmlAttribute) attributes2.GetNamedItem("lotNumber");
              if (namedItem4.Name == "lotNumber")
                Program.productList.lotNumber = namedItem4.Value.Trim();
              XmlAttribute namedItem5 = (XmlAttribute) attributes2.GetNamedItem("expirationDate");
              if (namedItem5.Name == "expirationDate")
                Program.productList.expirationDate = namedItem5.Value.Trim();
              XmlAttribute namedItem6 = (XmlAttribute) attributes2.GetNamedItem("PONumber");
              if (namedItem6 != null && namedItem6.Name == "PONumber")
                Program.productList.PONumber = namedItem6.Value.Trim();
              IEnumerator enumerator = childNode.ChildNodes.GetEnumerator();
              try
              {
                while (enumerator.MoveNext())
                {
                  XmlNode current = (XmlNode) enumerator.Current;
                  if (current.Name == "serialNumber")
                  {
                    Program.paketXml.serialNumbers.Add(current.InnerText.Trim());
                    Program.paketXml.carrierTypes.Add(Program.currentCarrierType);
                    Program.paketXml.IkicarrierTypes.Add(Program.IkicurrentCarrierType);
                    Program.paketXml.productList.Add(Program.productList);
                    Program.UccurrentCarrierType = new CarrierType();
                    Program.UccurrentCarrierType.carrierLabel = "";
                    Program.UccurrentCarrierType.containerType = "";
                    Program.paketXml.UccarrierTypes.Add(Program.UccurrentCarrierType);
                    Program.DortcurrentCarrierType = new CarrierType();
                    Program.DortcurrentCarrierType.carrierLabel = "";
                    Program.DortcurrentCarrierType.containerType = "";
                    Program.paketXml.DortcarrierTypes.Add(Program.DortcurrentCarrierType);
                    Program.BescurrentCarrierType = new CarrierType();
                    Program.BescurrentCarrierType.carrierLabel = "";
                    Program.BescurrentCarrierType.containerType = "";
                    Program.paketXml.BescarrierTypes.Add(Program.BescurrentCarrierType);
                    Program.AlticurrentCarrierType = new CarrierType();
                    Program.AlticurrentCarrierType.carrierLabel = "";
                    Program.AlticurrentCarrierType.containerType = "";
                    Program.paketXml.AlticarrierTypes.Add(Program.AlticurrentCarrierType);
                  }
                }
                break;
              }
              finally
              {
                if (enumerator is IDisposable disposable)
                  disposable.Dispose();
              }
          }
        }
      }
      return "";
    }

    private static string UcCarrierOlustur(XmlNode xchild)
    {
      if (xchild.Name == "carrier")
      {
        Program.UccurrentCarrierType = new CarrierType();
        XmlAttributeCollection attributes1 = xchild.Attributes;
        XmlAttribute namedItem1 = (XmlAttribute) attributes1.GetNamedItem("carrierLabel");
        if (namedItem1.Name == "carrierLabel")
          Program.UccurrentCarrierType.carrierLabel = namedItem1.Value.Trim();
        XmlAttribute namedItem2 = (XmlAttribute) attributes1.GetNamedItem("containerType");
        if (namedItem2 != null && namedItem2.Name == "containerType")
          Program.UccurrentCarrierType.containerType = namedItem2.Value.Trim();
        foreach (XmlNode childNode in xchild.ChildNodes)
        {
          switch (childNode.Name)
          {
            case "carrier":
              Program.DortCarrierOlustur(childNode);
              break;
            case "productList":
              Program.productList = new ProductList();
              XmlAttributeCollection attributes2 = childNode.Attributes;
              XmlAttribute namedItem3 = (XmlAttribute) attributes2.GetNamedItem("GTIN");
              if (namedItem3.Name == "GTIN")
                Program.productList.GTIN = namedItem3.Value.Trim();
              XmlAttribute namedItem4 = (XmlAttribute) attributes2.GetNamedItem("lotNumber");
              if (namedItem4.Name == "lotNumber")
                Program.productList.lotNumber = namedItem4.Value.Trim();
              XmlAttribute namedItem5 = (XmlAttribute) attributes2.GetNamedItem("expirationDate");
              if (namedItem5.Name == "expirationDate")
                Program.productList.expirationDate = namedItem5.Value.Trim();
              XmlAttribute namedItem6 = (XmlAttribute) attributes2.GetNamedItem("PONumber");
              if (namedItem6 != null && namedItem6.Name == "PONumber")
                Program.productList.PONumber = namedItem6.Value.Trim();
              IEnumerator enumerator = childNode.ChildNodes.GetEnumerator();
              try
              {
                while (enumerator.MoveNext())
                {
                  XmlNode current = (XmlNode) enumerator.Current;
                  if (current.Name == "serialNumber")
                  {
                    Program.paketXml.serialNumbers.Add(current.InnerText.Trim());
                    Program.paketXml.carrierTypes.Add(Program.currentCarrierType);
                    Program.paketXml.IkicarrierTypes.Add(Program.IkicurrentCarrierType);
                    Program.paketXml.UccarrierTypes.Add(Program.UccurrentCarrierType);
                    Program.paketXml.productList.Add(Program.productList);
                    Program.DortcurrentCarrierType = new CarrierType();
                    Program.DortcurrentCarrierType.carrierLabel = "";
                    Program.DortcurrentCarrierType.containerType = "";
                    Program.paketXml.DortcarrierTypes.Add(Program.DortcurrentCarrierType);
                    Program.BescurrentCarrierType = new CarrierType();
                    Program.BescurrentCarrierType.carrierLabel = "";
                    Program.BescurrentCarrierType.containerType = "";
                    Program.paketXml.BescarrierTypes.Add(Program.BescurrentCarrierType);
                    Program.AlticurrentCarrierType = new CarrierType();
                    Program.AlticurrentCarrierType.carrierLabel = "";
                    Program.AlticurrentCarrierType.containerType = "";
                    Program.paketXml.AlticarrierTypes.Add(Program.AlticurrentCarrierType);
                  }
                }
                break;
              }
              finally
              {
                if (enumerator is IDisposable disposable)
                  disposable.Dispose();
              }
          }
        }
      }
      return "";
    }

    private static string DortCarrierOlustur(XmlNode xchild)
    {
      if (xchild.Name == "carrier")
      {
        Program.DortcurrentCarrierType = new CarrierType();
        XmlAttributeCollection attributes1 = xchild.Attributes;
        XmlAttribute namedItem1 = (XmlAttribute) attributes1.GetNamedItem("carrierLabel");
        if (namedItem1.Name == "carrierLabel")
          Program.DortcurrentCarrierType.carrierLabel = namedItem1.Value.Trim();
        XmlAttribute namedItem2 = (XmlAttribute) attributes1.GetNamedItem("containerType");
        if (namedItem2 != null && namedItem2.Name == "containerType")
          Program.DortcurrentCarrierType.containerType = namedItem2.Value.Trim();
        foreach (XmlNode childNode in xchild.ChildNodes)
        {
          switch (childNode.Name)
          {
            case "carrier":
              Program.BesCarrierOlustur(childNode);
              break;
            case "productList":
              Program.productList = new ProductList();
              XmlAttributeCollection attributes2 = childNode.Attributes;
              XmlAttribute namedItem3 = (XmlAttribute) attributes2.GetNamedItem("GTIN");
              if (namedItem3.Name == "GTIN")
                Program.productList.GTIN = namedItem3.Value.Trim();
              XmlAttribute namedItem4 = (XmlAttribute) attributes2.GetNamedItem("lotNumber");
              if (namedItem4.Name == "lotNumber")
                Program.productList.lotNumber = namedItem4.Value.Trim();
              XmlAttribute namedItem5 = (XmlAttribute) attributes2.GetNamedItem("expirationDate");
              if (namedItem5.Name == "expirationDate")
                Program.productList.expirationDate = namedItem5.Value.Trim();
              XmlAttribute namedItem6 = (XmlAttribute) attributes2.GetNamedItem("PONumber");
              if (namedItem6 != null && namedItem6.Name == "PONumber")
                Program.productList.PONumber = namedItem6.Value.Trim();
              IEnumerator enumerator = childNode.ChildNodes.GetEnumerator();
              try
              {
                while (enumerator.MoveNext())
                {
                  XmlNode current = (XmlNode) enumerator.Current;
                  if (current.Name == "serialNumber")
                  {
                    Program.paketXml.serialNumbers.Add(current.InnerText.Trim());
                    Program.paketXml.carrierTypes.Add(Program.currentCarrierType);
                    Program.paketXml.IkicarrierTypes.Add(Program.IkicurrentCarrierType);
                    Program.paketXml.UccarrierTypes.Add(Program.UccurrentCarrierType);
                    Program.paketXml.DortcarrierTypes.Add(Program.DortcurrentCarrierType);
                    Program.paketXml.productList.Add(Program.productList);
                    Program.BescurrentCarrierType = new CarrierType();
                    Program.BescurrentCarrierType.carrierLabel = "";
                    Program.BescurrentCarrierType.containerType = "";
                    Program.paketXml.BescarrierTypes.Add(Program.BescurrentCarrierType);
                    Program.AlticurrentCarrierType = new CarrierType();
                    Program.AlticurrentCarrierType.carrierLabel = "";
                    Program.AlticurrentCarrierType.containerType = "";
                    Program.paketXml.AlticarrierTypes.Add(Program.AlticurrentCarrierType);
                  }
                }
                break;
              }
              finally
              {
                if (enumerator is IDisposable disposable)
                  disposable.Dispose();
              }
          }
        }
      }
      return "";
    }

    private static string BesCarrierOlustur(XmlNode xchild)
    {
      if (xchild.Name == "carrier")
      {
        Program.BescurrentCarrierType = new CarrierType();
        XmlAttributeCollection attributes1 = xchild.Attributes;
        XmlAttribute namedItem1 = (XmlAttribute) attributes1.GetNamedItem("carrierLabel");
        if (namedItem1.Name == "carrierLabel")
          Program.BescurrentCarrierType.carrierLabel = namedItem1.Value.Trim();
        XmlAttribute namedItem2 = (XmlAttribute) attributes1.GetNamedItem("containerType");
        if (namedItem2 != null && namedItem2.Name == "containerType")
          Program.BescurrentCarrierType.containerType = namedItem2.Value.Trim();
        foreach (XmlNode childNode in xchild.ChildNodes)
        {
          switch (childNode.Name)
          {
            case "carrier":
              Program.AltiCarrierOlustur(childNode);
              break;
            case "productList":
              Program.productList = new ProductList();
              XmlAttributeCollection attributes2 = childNode.Attributes;
              XmlAttribute namedItem3 = (XmlAttribute) attributes2.GetNamedItem("GTIN");
              if (namedItem3.Name == "GTIN")
                Program.productList.GTIN = namedItem3.Value.Trim();
              XmlAttribute namedItem4 = (XmlAttribute) attributes2.GetNamedItem("lotNumber");
              if (namedItem4.Name == "lotNumber")
                Program.productList.lotNumber = namedItem4.Value.Trim();
              XmlAttribute namedItem5 = (XmlAttribute) attributes2.GetNamedItem("expirationDate");
              if (namedItem5.Name == "expirationDate")
                Program.productList.expirationDate = namedItem5.Value.Trim();
              XmlAttribute namedItem6 = (XmlAttribute) attributes2.GetNamedItem("PONumber");
              if (namedItem6 != null && namedItem6.Name == "PONumber")
                Program.productList.PONumber = namedItem6.Value.Trim();
              IEnumerator enumerator = childNode.ChildNodes.GetEnumerator();
              try
              {
                while (enumerator.MoveNext())
                {
                  XmlNode current = (XmlNode) enumerator.Current;
                  if (current.Name == "serialNumber")
                  {
                    Program.paketXml.serialNumbers.Add(current.InnerText.Trim());
                    Program.paketXml.carrierTypes.Add(Program.currentCarrierType);
                    Program.paketXml.IkicarrierTypes.Add(Program.IkicurrentCarrierType);
                    Program.paketXml.UccarrierTypes.Add(Program.UccurrentCarrierType);
                    Program.paketXml.DortcarrierTypes.Add(Program.DortcurrentCarrierType);
                    Program.paketXml.BescarrierTypes.Add(Program.BescurrentCarrierType);
                    Program.paketXml.productList.Add(Program.productList);
                    Program.AlticurrentCarrierType = new CarrierType();
                    Program.AlticurrentCarrierType.carrierLabel = "";
                    Program.AlticurrentCarrierType.containerType = "";
                    Program.paketXml.AlticarrierTypes.Add(Program.AlticurrentCarrierType);
                  }
                }
                break;
              }
              finally
              {
                if (enumerator is IDisposable disposable)
                  disposable.Dispose();
              }
          }
        }
      }
      return "";
    }

    private static string AltiCarrierOlustur(XmlNode xchild)
    {
      if (xchild.Name == "carrier")
      {
        Program.AlticurrentCarrierType = new CarrierType();
        XmlAttributeCollection attributes1 = xchild.Attributes;
        XmlAttribute namedItem1 = (XmlAttribute) attributes1.GetNamedItem("carrierLabel");
        if (namedItem1.Name == "carrierLabel")
          Program.AlticurrentCarrierType.carrierLabel = namedItem1.Value.Trim();
        XmlAttribute namedItem2 = (XmlAttribute) attributes1.GetNamedItem("containerType");
        if (namedItem2 != null && namedItem2.Name == "containerType")
          Program.AlticurrentCarrierType.containerType = namedItem2.Value.Trim();
        foreach (XmlNode childNode1 in xchild.ChildNodes)
        {
          if (childNode1.Name == "productList")
          {
            Program.productList = new ProductList();
            XmlAttributeCollection attributes2 = childNode1.Attributes;
            XmlAttribute namedItem3 = (XmlAttribute) attributes2.GetNamedItem("GTIN");
            if (namedItem3.Name == "GTIN")
              Program.productList.GTIN = namedItem3.Value.Trim();
            XmlAttribute namedItem4 = (XmlAttribute) attributes2.GetNamedItem("lotNumber");
            if (namedItem4.Name == "lotNumber")
              Program.productList.lotNumber = namedItem4.Value.Trim();
            XmlAttribute namedItem5 = (XmlAttribute) attributes2.GetNamedItem("expirationDate");
            if (namedItem5.Name == "expirationDate")
              Program.productList.expirationDate = namedItem5.Value.Trim();
            XmlAttribute namedItem6 = (XmlAttribute) attributes2.GetNamedItem("PONumber");
            if (namedItem6 != null && namedItem6.Name == "PONumber")
              Program.productList.PONumber = namedItem6.Value.Trim();
            foreach (XmlNode childNode2 in childNode1.ChildNodes)
            {
              if (childNode2.Name == "serialNumber")
              {
                Program.paketXml.serialNumbers.Add(childNode2.InnerText.Trim());
                Program.paketXml.carrierTypes.Add(Program.currentCarrierType);
                Program.paketXml.productList.Add(Program.productList);
                Program.paketXml.IkicarrierTypes.Add(Program.IkicurrentCarrierType);
                Program.paketXml.UccarrierTypes.Add(Program.UccurrentCarrierType);
                Program.paketXml.DortcarrierTypes.Add(Program.DortcurrentCarrierType);
                Program.paketXml.BescarrierTypes.Add(Program.BescurrentCarrierType);
                Program.paketXml.AlticarrierTypes.Add(Program.AlticurrentCarrierType);
              }
            }
          }
        }
      }
      return "";
    }

    private static async Task<string> FindPackage(
      string destinationGLN,
      string userName,
      string pwd,
      DatabaseConfig dbConfig,
      string startDateString,
      string endDateString)
    {
      string sourceGLN = "";
      Console.WriteLine("TARİH AYARLANIYOR");
      DateTime startDate = DateTime.Parse(startDateString);
      DateTime endDate = DateTime.Parse(endDateString);
      Console.WriteLine("TARİH AYANLANDI");
      string Token = Program.GetToken(userName, pwd).Result.ToString();
      Console.WriteLine(Token);
      string result = "";
      Console.WriteLine("Servise Gidiyor");
      HttpClient hc = new HttpClient();
      StringContent Json = new StringContent(JsonConvert.SerializeObject((object) new
      {
        sourceGln = sourceGLN,
        destinationGln = destinationGLN,
        bringNotReceivedTransferInfo = 0,
        startDate = startDate.ToString("yyyy-MM-dd"),
        endDate = endDate.ToString("yyyy-MM-dd")
      }), Encoding.UTF8, "application/json");
      hc.DefaultRequestHeaders.Add("Authorization", "Bearer " + Token);
      HttpResponseMessage resultJson = hc.PostAsync("https://its2.saglik.gov.tr/pts/app/search/", (HttpContent) Json).Result;
      Console.WriteLine("Cevap Alındı");
      string jsonResult = await resultJson.Content.ReadAsStringAsync();
      Console.WriteLine("Cevap Alındı - 1");
      Program.MainFileList response = JsonConvert.DeserializeObject<Program.MainFileList>(jsonResult);
      Console.WriteLine("Cevap Alındı - 2");
      if (!resultJson.IsSuccessStatusCode)
      {
        Console.WriteLine("PTS Sorgulama WS Bağlantı Hatası \n" + jsonResult.ToString());
        throw new ArgumentException("PTS Sorgulama WS Bağlantı Hatası \n" + jsonResult.ToString());
      }
      try
      {
        int num;
        if (response.transferDetails != null)
        {
          num = response.transferDetails.Count;
          Console.WriteLine("Alınan Belge Sayısı : " + num.ToString());
        }
        else
          Console.WriteLine("Alınan Belge Sayısı : YOK " + jsonResult.ToString());
        for (int i = 0; i < response.transferDetails.Count; num = i++)
        {
          Console.WriteLine("Dosya İşleniyor " + i.ToString());
          string source_GLN = response.transferDetails[i].sourceGln;
          long transfer_ID = response.transferDetails[i].transferId;
          Program.getAndSaveFile(source_GLN, transfer_ID, userName, pwd, dbConfig);
          source_GLN = (string) null;
        }
      }
      catch (Exception ex)
      {
        Exception e = ex;
      }
      Console.WriteLine("İşlem Tamamlandı.");
      string package = "";
      sourceGLN = (string) null;
      Token = (string) null;
      result = (string) null;
      hc = (HttpClient) null;
      Json = (StringContent) null;
      resultJson = (HttpResponseMessage) null;
      jsonResult = (string) null;
      response = (Program.MainFileList) null;
      return package;
    }

    private static string GetTranferId(
      string destinationGLN,
      string userName,
      string pwd,
      DatabaseConfig dbConfig,
      string TransferId,
      string source_GLN)
    {
      Console.WriteLine("PARAMETRELER AYARLANDI");
      try
      {
        long transferId = long.Parse(TransferId);
        Program.getAndSaveFile(source_GLN, transferId, userName, pwd, dbConfig);
      }
      catch (Exception ex)
      {
      }
      return "";
    }

    private static string NhlSipDurumSor(
      string ViewStr,
      string ServiceName,
      string TokenKey,
      DatabaseConfig dbConfig)
    {
      if (string.IsNullOrEmpty(ViewStr) || string.IsNullOrEmpty(ServiceName) || string.IsNullOrEmpty(TokenKey))
        return "Hata Boş Olamaz";
      using (SqlConnection connection = new SqlConnection("Data Source=" + dbConfig.DbServer + ";Initial Catalog=" + dbConfig.DbName + ";User Id=" + dbConfig.DbUser + ";Password=" + dbConfig.DbPass + ";"))
      {
        connection.Open();
        using (SqlCommand sqlCommand = new SqlCommand("SELECT * FROM " + ViewStr, connection))
        {
          DataTable dataTable1 = new DataTable();
          dataTable1.Load((IDataReader) sqlCommand.ExecuteReader());
          if (dataTable1.Rows.Count <= 0)
            return "Kayıt Bulunamadı!";
          GenericService genericService = new GenericService();
          PullParameters Datas1 = new PullParameters();
          Datas1.ServiceName = ServiceName;
          List<PullDataRowItem> pullDataRowItemList1 = new List<PullDataRowItem>();
          PullDataRowItem pullDataRowItem = new PullDataRowItem();
          for (int index1 = 0; index1 < dataTable1.Rows.Count; ++index1)
          {
            for (int index2 = 0; index2 < dataTable1.Columns.Count; ++index2)
              pullDataRowItemList1.Add(new PullDataRowItem()
              {
                ColumnName = dataTable1.Columns[index2].Caption,
                Value = (object) dataTable1.Rows[index1][index2].ToString()
              });
          }
          Datas1.Conditions = pullDataRowItemList1.ToArray();
          PullResult pullResult = genericService.PullDatas(TokenKey, Datas1);
          DataTable dataTable2 = new DataTable();
          DataTable table = pullResult.ResultData.Tables[0];
          if (table.Rows.Count > 0)
          {
            for (int index = 0; index < table.Rows.Count; ++index)
            {
              string str = "";
              for (int columnIndex = 0; columnIndex < table.Columns.Count; ++columnIndex)
                str = str + "'" + table.Rows[index][columnIndex].ToString() + "',";
              if (ViewStr == "AVIEW_MUSSIPSORGU")
                sqlCommand.CommandText = "INSERT INTO ATBLNHLRETURN ([LSP2CUSTOMER],[PROCESSTYPE],[COMPANYCODE],[WAREHOUSECODE],[WSMMOVEMENTTYPE],[CUSTOMERMOVEMENTTYPE],[SKUCODE],[SKULOT],[QUANTITY],[DELIVERYNUMBER],[ORDERNUMBER],[ORDERLINENUMBER],[ORDERCUSTOMER],[DELIVERYCUSTOMER],[CREATEDATE],[CREATETIME],[CUSTOMERCODE])SELECT " + str.Substring(0, str.Length - 1);
              else
                sqlCommand.CommandText = "INSERT INTO ATBLNHLRETURN ([LSP2CUSTOMER],[PROCESSTYPE],[COMPANYCODE],[WAREHOUSECODE],[WSMMOVEMENTTYPE],[CUSTOMERMOVEMENTTYPE],[SKUCODE],[SKULOT],[QUANTITY],[STOREINORDERNUMBER],[ORDERLINENUMBER],[ORDERCUSTOMER],[DELIVERYCUSTOMER],[CREATEDATE],[CREATETIME],[CUSTOMERCODE],[WAYBILLNUMBER],[WAYBILLDATE])SELECT " + str.Substring(0, str.Length - 1);
              sqlCommand.ExecuteScalar();
            }
          }
          Pull_CompleteParameters Datas2 = new Pull_CompleteParameters();
          List<PullDataRowItem> pullDataRowItemList2 = new List<PullDataRowItem>();
          foreach (DataRow row in (InternalDataCollectionBase) pullResult.ResultData.Tables[0].Rows)
            pullDataRowItemList2.Add(new PullDataRowItem()
            {
              ColumnName = pullResult.PrimaryColumn,
              Value = row[pullResult.PrimaryColumn]
            });
          Datas2.ServiceName = ServiceName;
          Datas2.Keys = pullDataRowItemList2.ToArray();
          genericService.PullDatas_Complete(TokenKey, Datas2);
        }
      }
      return "";
    }

    public class Token
    {
      public string token { get; set; }
    }

    public class SendFile
    {
      public string transferId { get; set; }

      public string md5CheckSum { get; set; }
    }

    public class GetFile
    {
      public string fileStream { get; set; }

      public string streamMD5checksum { get; set; }
    }

    public class FileList
    {
      public string sourceGln { get; set; }

      public string destinationGln { get; set; }

      public long transferId { get; set; }

      public string transferDate { get; set; }
    }

    public class MainFileList
    {
      public List<Program.FileList> transferDetails { get; set; }
    }
  }
}
