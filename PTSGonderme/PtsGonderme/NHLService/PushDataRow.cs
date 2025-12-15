// Decompiled with JetBrains decompiler
// Type: PtsGonderme.NHLService.PushDataRow
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Xml.Serialization;

#nullable disable
namespace PtsGonderme.NHLService
{
  [GeneratedCode("System.Xml", "4.8.4084.0")]
  [DebuggerStepThrough]
  [DesignerCategory("code")]
  [XmlType(Namespace = "http://tempuri.org/")]
  [Serializable]
  public class PushDataRow
  {
    private PushRowResult pushResultField;
    private PushDataRowItem[] rowItemsField;

    public PushRowResult PushResult
    {
      get => this.pushResultField;
      set => this.pushResultField = value;
    }

    public PushDataRowItem[] RowItems
    {
      get => this.rowItemsField;
      set => this.rowItemsField = value;
    }
  }
}
