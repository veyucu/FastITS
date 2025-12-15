// Decompiled with JetBrains decompiler
// Type: PtsGonderme.PaketXml
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System;
using System.Collections.Generic;
using System.Data.SqlClient;

#nullable disable
namespace PtsGonderme
{
  public class PaketXml
  {
    public string sourceGLN;
    public string destinationGLN;
    public string actionType;
    public string shipTo;
    public string documentNumber;
    public string documentDate;
    public string note;
    public string version;
    public List<ProductList> productList = new List<ProductList>();
    public List<string> serialNumbers = new List<string>();
    public List<CarrierType> carrierTypes = new List<CarrierType>();
    public List<CarrierType> IkicarrierTypes = new List<CarrierType>();
    public List<CarrierType> UccarrierTypes = new List<CarrierType>();
    public List<CarrierType> DortcarrierTypes = new List<CarrierType>();
    public List<CarrierType> BescarrierTypes = new List<CarrierType>();
    public List<CarrierType> AlticarrierTypes = new List<CarrierType>();

    public bool SaveToDB(string transferId, DatabaseConfig dbConfig)
    {
      try
      {
        using (SqlConnection connection = new SqlConnection("Data Source=" + dbConfig.DbServer + ";Initial Catalog=" + dbConfig.DbName + ";User Id=" + dbConfig.DbUser + ";Password=" + dbConfig.DbPass + ";"))
        {
          Console.WriteLine("CONNECTİON OLUŞTURULDU");
          connection.Open();
          Console.WriteLine("CONNECTİON AÇILDI");
          using (SqlCommand sqlCommand = new SqlCommand())
          {
            sqlCommand.Parameters.Clear();
            sqlCommand.Connection = connection;
            sqlCommand.CommandText = "INSERT INTO ATBLPTSMAS(TRANSFER_ID, SOURCE_GLN, DESTINATION_GLN, ACTION_TYPE, SHIP_TO, DOCUMENT_NUMBER, DOCUMENT_DATE, NOTE, INSERT_DATE) VALUES(@TRANSFER_ID, @SOURCE_GLN, @DESTINATION_GLN, @ACTION_TYPE, @SHIP_TO, @DOCUMENT_NUMBER, @DOCUMENT_DATE, @NOTE, @INSERT_DATE)";
            sqlCommand.Parameters.AddWithValue("TRANSFER_ID", (object) PaketXml.NullToString(transferId));
            sqlCommand.Parameters.AddWithValue("SOURCE_GLN", (object) PaketXml.NullToString(this.sourceGLN));
            sqlCommand.Parameters.AddWithValue("DESTINATION_GLN", (object) PaketXml.NullToString(this.destinationGLN));
            sqlCommand.Parameters.AddWithValue("ACTION_TYPE", (object) PaketXml.NullToString(this.actionType));
            sqlCommand.Parameters.AddWithValue("SHIP_TO", (object) PaketXml.NullToString(this.shipTo));
            sqlCommand.Parameters.AddWithValue("DOCUMENT_NUMBER", (object) PaketXml.NullToString(this.documentNumber));
            sqlCommand.Parameters.AddWithValue("DOCUMENT_DATE", (object) PaketXml.NullToString(this.documentDate));
            sqlCommand.Parameters.AddWithValue("NOTE", (object) PaketXml.NullToString(this.note));
            sqlCommand.Parameters.AddWithValue("INSERT_DATE", (object) DateTime.Now);
            sqlCommand.ExecuteScalar();
            Console.WriteLine("ÜST KAYITLAR YAZILDI");
          }
          using (SqlCommand sqlCommand = new SqlCommand())
          {
            for (int index = 0; index < this.serialNumbers.Count; ++index)
            {
              sqlCommand.Parameters.Clear();
              sqlCommand.Connection = connection;
              sqlCommand.CommandText = "INSERT INTO ATBLPTSTRA(TRANSFER_ID, GTIN, EXPRATION_DATE, PRODUCTION_DATE, LOT_NUMBER, SERIAL_NUMBER, PO_NUMBER, CARRIER_LABEL, CONTAINER_TYPE, IC_CARRIER_LABEL, IC_CONTAINER_TYPE, STOK_KOD, CARRIER_LABEL3, CONTAINER_TYPE3, CARRIER_LABEL4, CONTAINER_TYPE4,CARRIER_LABEL5, CONTAINER_TYPE5,CARRIER_LABEL6, CONTAINER_TYPE6) VALUES(@TRANSFER_ID, @GTIN, @EXPRATION_DATE, @PRODUCTION_DATE, @LOT_NUMBER, @SERIAL_NUMBER, @PO_NUMBER, @CARRIER_LABEL, @CONTAINER_TYPE, @IC_CARRIER_LABEL, @IC_CONTAINER_TYPE, @STOK_KOD, @CARRIER_LABEL3, @CONTAINER_TYPE3, @CARRIER_LABEL4, @CONTAINER_TYPE4, @CARRIER_LABEL5, @CONTAINER_TYPE5, @CARRIER_LABEL6, @CONTAINER_TYPE6)";
              ProductList product = this.productList[index];
              sqlCommand.Parameters.Add(new SqlParameter("TRANSFER_ID", (object) PaketXml.NullToString(transferId)));
              sqlCommand.Parameters.Add(new SqlParameter("GTIN", (object) PaketXml.NullToString(product.GTIN)));
              sqlCommand.Parameters.Add(new SqlParameter("EXPRATION_DATE", (object) PaketXml.NullToString(product.expirationDate)));
              sqlCommand.Parameters.Add(new SqlParameter("PRODUCTION_DATE", (object) PaketXml.NullToString(product.productionDate)));
              sqlCommand.Parameters.Add(new SqlParameter("LOT_NUMBER", (object) PaketXml.NullToString(product.lotNumber)));
              sqlCommand.Parameters.Add(new SqlParameter("SERIAL_NUMBER", (object) PaketXml.NullToString(this.serialNumbers[index])));
              sqlCommand.Parameters.Add(new SqlParameter("PO_NUMBER", (object) PaketXml.NullToString(product.PONumber)));
              CarrierType carrierType = this.carrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("CARRIER_LABEL", (object) PaketXml.NullToString(carrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("CONTAINER_TYPE", (object) PaketXml.NullToString(carrierType.containerType)));
              CarrierType ikicarrierType = this.IkicarrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("IC_CARRIER_LABEL", (object) PaketXml.NullToString(ikicarrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("IC_CONTAINER_TYPE", (object) PaketXml.NullToString(ikicarrierType.containerType)));
              CarrierType uccarrierType = this.UccarrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("CARRIER_LABEL3", (object) PaketXml.NullToString(uccarrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("CONTAINER_TYPE3", (object) PaketXml.NullToString(uccarrierType.containerType)));
              CarrierType dortcarrierType = this.DortcarrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("CARRIER_LABEL4", (object) PaketXml.NullToString(dortcarrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("CONTAINER_TYPE4", (object) PaketXml.NullToString(dortcarrierType.containerType)));
              CarrierType bescarrierType = this.BescarrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("CARRIER_LABEL5", (object) PaketXml.NullToString(bescarrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("CONTAINER_TYPE5", (object) PaketXml.NullToString(bescarrierType.containerType)));
              CarrierType alticarrierType = this.AlticarrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("CARRIER_LABEL6", (object) PaketXml.NullToString(alticarrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("CONTAINER_TYPE6", (object) PaketXml.NullToString(alticarrierType.containerType)));
              string stokKod = PaketXml.GetStokKod(PaketXml.NullToString(product.GTIN), connection);
              sqlCommand.Parameters.Add(new SqlParameter("STOK_KOD", (object) stokKod));
              sqlCommand.ExecuteScalar();
              Console.WriteLine("KALEMLER YAZILDI.");
            }
          }
          connection.Close();
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine(ex.ToString());
      }
      return false;
    }

    private static string NullToString(string str) => string.IsNullOrEmpty(str) ? "" : str;

    private static string GetStokKod(string GTIN, SqlConnection connection)
    {
      string str = GTIN.Substring(1);
      using (SqlCommand sqlCommand = new SqlCommand("SELECT STOK_KODU FROM TBLSTSABIT WHERE STOK_KODU=@STOK_KODU OR BARKOD1=@BARKOD1 OR BARKOD2=@BARKOD2 OR BARKOD3=@BARKOD3", connection))
      {
        sqlCommand.Parameters.Clear();
        sqlCommand.Parameters.Add(new SqlParameter("STOK_KODU", (object) str));
        sqlCommand.Parameters.Add(new SqlParameter("BARKOD1", (object) str));
        sqlCommand.Parameters.Add(new SqlParameter("BARKOD2", (object) str));
        sqlCommand.Parameters.Add(new SqlParameter("BARKOD3", (object) str));
        SqlDataReader sqlDataReader = sqlCommand.ExecuteReader();
        if (sqlDataReader.Read())
        {
          string stokKod = sqlDataReader.GetString(sqlDataReader.GetOrdinal("STOK_KODU"));
          sqlDataReader.Close();
          return stokKod;
        }
        sqlDataReader.Close();
      }
      using (SqlCommand sqlCommand = new SqlCommand("SELECT STOK_KODU FROM TBLSTOKBAR WHERE STOK_KODU=@STOK_KODU", connection))
      {
        sqlCommand.Parameters.Clear();
        sqlCommand.Parameters.Add(new SqlParameter("STOK_KODU", (object) str));
        SqlDataReader sqlDataReader = sqlCommand.ExecuteReader();
        if (sqlDataReader.Read())
        {
          string stokKod = sqlDataReader.GetString(sqlDataReader.GetOrdinal("STOK_KODU"));
          sqlDataReader.Close();
          return stokKod;
        }
        sqlDataReader.Close();
      }
      return "";
    }

    public string doldur(string xstr, int boyut, string Karakter, bool yon)
    {
      if (yon)
      {
        for (int length = xstr.Length; length < boyut; ++length)
          xstr = Karakter + xstr;
      }
      else
      {
        for (int length = xstr.Length; length < boyut; ++length)
          xstr += Karakter;
      }
      return xstr;
    }
  }
}
